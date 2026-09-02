/**
 * SSE notification stream — connection registry + event transport.
 *
 * TWO TRANSPORTS, selected by platform capability (not by a compat flag):
 *
 *  - **Persistent host** (container / fly / railway): a module-level Map is the
 *    whole story. The process holding the connection is the process that emits,
 *    so an in-memory enqueue reaches every stream. Zero latency, zero cost.
 *
 *  - **Serverless** (Vercel): every lambda instance gets its OWN module scope,
 *    so the Map in the instance that handled `POST /send` is not the Map in the
 *    instance parked on the client's `EventSource`. An in-memory enqueue there
 *    reaches nobody. Events go over Redis pub/sub instead: each stream
 *    subscribes to its user's channel on connect, and emitters publish.
 *
 * On the pub/sub path the emitter does NOT also enqueue locally — the local
 * stream is itself a subscriber and receives its own publish back. One delivery
 * path, so no dedup logic and no double-fire.
 *
 * NOT SOLVED HERE: Redis pub/sub is fire-and-forget with no replay, so anything
 * published while a client is between reconnects is lost. The route re-sends an
 * `init` frame carrying the authoritative unread count on every connect, which
 * self-heals the badge within one reconnect (≤55s); per-item replay via SSE
 * `id:` + `Last-Event-ID` is not built.
 */
import { redis } from '$lib/server/cache';
import { platform } from '$lib/server/platform';
import { SSE_MAX_PER_USER } from './config';

type StreamController = ReadableStreamDefaultController<Uint8Array>;

const streams = new Map<string, Set<StreamController>>();
const encoder = new TextEncoder();

/** Per-user pub/sub channel. */
function channelFor(userId: string): string {
	return `notif:stream:${userId}`;
}

/**
 * True when this host cannot trust its own memory to reach every stream.
 * `redis === null` (Upstash unconfigured, e.g. a bare local run) falls back to
 * the in-memory path rather than dropping events on the floor.
 */
export function usesPubSub(): boolean {
	return !platform.persistent && redis !== null;
}

/**
 * The SSE wire frame. Shared by both transports so a subscriber-delivered event
 * is byte-identical to a locally-enqueued one.
 */
export function encodeEvent(data: Record<string, unknown>): Uint8Array {
	const eventName = typeof data.type === 'string' ? data.type : null;
	const prefix = eventName ? `event: ${eventName}\n` : '';
	return encoder.encode(`${prefix}data: ${JSON.stringify(data)}\n\n`);
}

/** Register a new SSE stream for a user. Returns false if limit reached. */
export function registerStream(userId: string, controller: StreamController): boolean {
	let userStreams = streams.get(userId);
	if (!userStreams) {
		userStreams = new Set();
		streams.set(userId, userStreams);
	}
	if (userStreams.size >= SSE_MAX_PER_USER) return false;
	userStreams.add(controller);
	return true;
}

/** Remove a stream when the connection closes */
export function unregisterStream(userId: string, controller: StreamController) {
	const userStreams = streams.get(userId);
	if (!userStreams) return;
	userStreams.delete(controller);
	if (userStreams.size === 0) streams.delete(userId);
}

/** Push a frame to the streams this instance is holding. */
export function enqueueLocal(userId: string, payload: Uint8Array): void {
	const userStreams = streams.get(userId);
	if (!userStreams) return;
	for (const controller of userStreams) {
		try {
			controller.enqueue(payload);
		} catch {
			// Stream closed — will be cleaned up via abort handler
		}
	}
}

/**
 * Push a notification event to all of a user's active SSE connections,
 * wherever they are being held.
 *
 * A publish failure is logged and degraded to a local enqueue — it must never
 * propagate, because the caller is `sendNotification`, and losing a
 * live-update frame is not a reason to fail creating the notification.
 */
export async function notifyUser(userId: string, data: Record<string, unknown>): Promise<void> {
	if (!usesPubSub()) {
		enqueueLocal(userId, encodeEvent(data));
		return;
	}
	try {
		await redis?.publish(channelFor(userId), data);
	} catch (err) {
		console.error('[sse:notifications] publish failed, falling back to local enqueue:', err);
		enqueueLocal(userId, encodeEvent(data));
	}
}

/**
 * Subscribe one stream to its user's channel.
 *
 * Returns an unsubscribe function, or `null` when this host does not use
 * pub/sub (nothing to tear down). The caller is responsible for invoking it
 * exactly once — the route does so from its existing `release()`.
 */
export function subscribeUser(userId: string, onEvent: (data: Record<string, unknown>) => void): (() => void) | null {
	if (!usesPubSub() || !redis) return null;

	const sub = redis.subscribe<Record<string, unknown>>([channelFor(userId)]);
	sub.on('message', ({ message }) => {
		try {
			onEvent(message);
		} catch (err) {
			console.error('[sse:notifications] subscriber handler threw:', err);
		}
	});
	sub.on('error', (err) => {
		console.error('[sse:notifications] subscription error:', err);
	});

	return () => {
		sub.removeAllListeners();
		void sub.unsubscribe().catch(() => {
			// Connection is going away regardless.
		});
	};
}
