import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { guardApiUser } from '$lib/server/auth/guards';
import { SSE_HEARTBEAT_MS, SSE_RATE_LIMIT_MAX, SSE_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { getUnreadCount } from '$lib/server/db/notifications/queries';
import { registerStream, unregisterStream } from '$lib/server/notifications';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:stream', SSE_RATE_LIMIT_MAX, SSE_RATE_LIMIT_WINDOW);

// Long-lived SSE: pin the function to its billable window and close ourselves just
// before the platform kill, so EventSource reconnects cleanly instead of churning
// re-auth + a DB read on every premature default-timeout cut. 60 is the Hobby
// ceiling; on Pro raise both to 300 / 290_000.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };
const MAX_STREAM_DURATION_MS = 55_000;

export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const encoder = new TextEncoder();
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
	let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
	let released = false;

	// Drop the registry slot and clear timers exactly once, whether the client
	// disconnects (cancel) or the lifetime cap closes the stream. Previously only
	// cancel() unregistered, so the self-close path — the one EVERY stream takes
	// at 55s — leaked a slot per reconnect until the user hit their own
	// too_many_connections cap. Mirrors api/analytics/stream's release().
	function release() {
		if (released) return;
		released = true;
		if (heartbeatTimer) clearInterval(heartbeatTimer);
		if (lifetimeTimer) clearTimeout(lifetimeTimer);
		if (streamController) {
			unregisterStream(user.id, streamController);
			streamController = undefined;
		}
	}

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const registered = registerStream(user.id, controller);
			if (!registered) {
				// Leave streamController unset: no slot was taken, so a later
				// release() must not unregister a controller we never registered.
				controller.enqueue(encoder.encode('data: {"error":"too_many_connections"}\n\n'));
				controller.close();
				return;
			}
			streamController = controller;

			// Send initial unread count (named event so client addEventListener('init', ...) fires)
			try {
				const count = await getUnreadCount(user.id);
				controller.enqueue(encoder.encode(`event: init\ndata: ${JSON.stringify({ unreadCount: count })}\n\n`));
			} catch (err) {
				console.error('[sse:notifications] Failed to fetch initial count:', err);
				controller.enqueue(encoder.encode(`event: init\ndata: ${JSON.stringify({ unreadCount: 0 })}\n\n`));
			}

			// Heartbeat to keep connection alive
			heartbeatTimer = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
				} catch {
					// Stream already closed under us — surrender the slot too, not
					// just the timer, or it stays held until the lifetime cap.
					release();
				}
			}, SSE_HEARTBEAT_MS);

			// Hard lifetime cap — end the stream just before the platform kills the
			// function so the client reconnects cleanly.
			lifetimeTimer = setTimeout(() => {
				try {
					controller.close();
				} catch {
					// already closed
				}
				release();
			}, MAX_STREAM_DURATION_MS);
		},
		cancel() {
			release();
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	});
};
