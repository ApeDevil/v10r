/**
 * Analytics SSE stream — simulates real-time analytics events for the demo.
 * No auth required (showcase-only, synthetic data).
 */

import { SSE_HEARTBEAT_MS } from '$lib/server/config';
import type { RequestHandler } from './$types';

const PAGE_PATHS = [
	'/',
	'/pricing',
	'/docs',
	'/docs/getting-started',
	'/docs/api',
	'/blog',
	'/blog/release-v2',
	'/about',
	'/contact',
	'/signup',
];

const EVENT_TYPES = ['pageview', 'pageview', 'pageview', 'pageview', 'action', 'action', 'timing'];

function randomEvent(id: number) {
	return {
		id,
		type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
		path: PAGE_PATHS[Math.floor(Math.random() * PAGE_PATHS.length)],
		timestamp: new Date().toISOString(),
		sessionId: `s_demo_${Math.random().toString(36).slice(2, 10)}`,
	};
}

export const GET: RequestHandler = async () => {
	const encoder = new TextEncoder();
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	let eventTimer: ReturnType<typeof setInterval> | undefined;
	let eventId = 0;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			// Send init with simulated active sessions
			const activeSessions = Math.floor(Math.random() * 15) + 5;
			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', activeSessions })}\n\n`));

			// Emit simulated events at random intervals (1-5 seconds)
			function scheduleNext() {
				const delay = 1000 + Math.random() * 4000;
				eventTimer = setTimeout(() => {
					try {
						eventId++;
						const event = randomEvent(eventId);
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'event', event })}\n\n`));

						// Occasionally update active sessions count
						if (eventId % 5 === 0) {
							const count = Math.floor(Math.random() * 15) + 5;
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'sessions', count })}\n\n`));
						}

						scheduleNext();
					} catch {
						// Stream closed
					}
				}, delay);
			}

			scheduleNext();

			// Heartbeat
			heartbeatTimer = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
				} catch {
					if (heartbeatTimer) clearInterval(heartbeatTimer);
				}
			}, SSE_HEARTBEAT_MS);
		},
		cancel() {
			if (heartbeatTimer) clearInterval(heartbeatTimer);
			if (eventTimer) clearTimeout(eventTimer);
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
