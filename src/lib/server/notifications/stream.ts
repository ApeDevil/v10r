/**
 * SSE notification stream — in-memory registry of active connections.
 * Each user can have up to SSE_MAX_PER_USER concurrent connections.
 */
import { SSE_MAX_PER_USER } from '$lib/server/config';

type StreamController = ReadableStreamDefaultController<Uint8Array>;

const streams = new Map<string, Set<StreamController>>();

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

/** Push a notification event to all of a user's active SSE connections */
export function notifyUser(userId: string, data: Record<string, unknown>) {
	const userStreams = streams.get(userId);
	if (!userStreams) return;

	const encoder = new TextEncoder();
	const eventName = typeof data.type === 'string' ? data.type : null;
	const prefix = eventName ? `event: ${eventName}\n` : '';
	const payload = encoder.encode(`${prefix}data: ${JSON.stringify(data)}\n\n`);

	for (const controller of userStreams) {
		try {
			controller.enqueue(payload);
		} catch {
			// Stream closed — will be cleaned up via abort handler
		}
	}
}
