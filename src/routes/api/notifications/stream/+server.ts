import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
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
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const encoder = new TextEncoder();
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
	let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			streamController = controller;
			const registered = registerStream(user.id, controller);
			if (!registered) {
				controller.enqueue(encoder.encode('data: {"error":"too_many_connections"}\n\n'));
				controller.close();
				return;
			}

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
					// Stream closed
					if (heartbeatTimer) clearInterval(heartbeatTimer);
				}
			}, SSE_HEARTBEAT_MS);

			// Hard lifetime cap — end the stream just before the platform kills the
			// function so the client reconnects cleanly.
			lifetimeTimer = setTimeout(() => {
				if (heartbeatTimer) clearInterval(heartbeatTimer);
				try {
					controller.close();
				} catch {
					// already closed
				}
			}, MAX_STREAM_DURATION_MS);
		},
		cancel() {
			if (heartbeatTimer) clearInterval(heartbeatTimer);
			if (lifetimeTimer) clearTimeout(lifetimeTimer);
			if (streamController) unregisterStream(user.id, streamController);
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
