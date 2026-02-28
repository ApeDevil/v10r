import { requireApiUser } from '$lib/server/auth/guards';
import { getUnreadCount } from '$lib/server/db/notifications/queries';
import { registerStream, unregisterStream } from '$lib/server/notifications';
import { SSE_HEARTBEAT_MS } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const encoder = new TextEncoder();
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
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

			// Send initial unread count
			const count = await getUnreadCount(user.id);
			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', unreadCount: count })}\n\n`));

			// Heartbeat to keep connection alive
			heartbeatTimer = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
				} catch {
					// Stream closed
					if (heartbeatTimer) clearInterval(heartbeatTimer);
				}
			}, SSE_HEARTBEAT_MS);
		},
		cancel() {
			if (heartbeatTimer) clearInterval(heartbeatTimer);
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
