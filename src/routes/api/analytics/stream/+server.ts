/**
 * Analytics SSE stream — simulates real-time analytics events for the demo.
 * No auth required (showcase-only, synthetic data), so it carries its own abuse
 * controls: per-IP connect limit, a global concurrent-connection ceiling, and a
 * hard max duration so an attacker can't pin open unbounded serverless functions.
 */

import { ipLimitKey } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { SSE_HEARTBEAT_MS } from '$lib/server/notifications/config';
import type { RequestHandler } from './$types';

const connectLimiter = createLimiter('rl:analytics:stream', 10, '1 m');
const MAX_CONCURRENT_STREAMS = 100;
// Must stay UNDER the function's maxDuration (60) so the stream closes itself
// gracefully. At the previous 300_000 the in-code close never fired: Vercel killed
// the function at 60s, the client saw `onerror` instead of a clean end, and
// reconnected after a 3s gap — every minute, per open tab. Matches the
// notifications stream, which already used 55_000 for this reason.
const MAX_STREAM_DURATION_MS = 55_000;
let activeStreams = 0;

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

// Pin to the max billable window so the stream isn't cut at the platform default.
// (60 = Hobby ceiling; raise to 300 on Pro to honour the 5-min in-code cap.)
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const GET: RequestHandler = async ({ locals, getClientAddress }) => {
	const { success, reset } = await connectLimiter.limit(ipLimitKey(locals.clientIp ?? getClientAddress()));
	if (!success) return rateLimitResponse(reset);

	if (activeStreams >= MAX_CONCURRENT_STREAMS) {
		return new Response('Too many concurrent streams', { status: 503, headers: { 'Retry-After': '30' } });
	}

	const encoder = new TextEncoder();
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	let eventTimer: ReturnType<typeof setTimeout> | undefined;
	let durationTimer: ReturnType<typeof setTimeout> | undefined;
	let eventId = 0;
	let released = false;

	// Decrement the global counter and clear timers exactly once, whether the
	// client disconnects (cancel) or the duration cap closes the stream.
	function release() {
		if (released) return;
		released = true;
		activeStreams = Math.max(0, activeStreams - 1);
		if (heartbeatTimer) clearInterval(heartbeatTimer);
		if (eventTimer) clearTimeout(eventTimer);
		if (durationTimer) clearTimeout(durationTimer);
	}

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			activeStreams++;

			// Hard cap on stream lifetime — bounds serverless function time.
			durationTimer = setTimeout(() => {
				try {
					controller.close();
				} catch {
					// already closed
				}
				release();
			}, MAX_STREAM_DURATION_MS);

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
					release();
				}
			}, SSE_HEARTBEAT_MS);
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
