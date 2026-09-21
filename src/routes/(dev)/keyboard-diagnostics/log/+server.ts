import type { RequestHandler } from './$types';

/**
 * Log sink for the on-device keyboard diagnostics page. Dev-only (`(dev)`
 * routes 404 in production — devRouteGuard). The phone has no DevTools, and a
 * page whose main thread hangs cannot show its own last lines: every event the
 * page records is also POSTed here and printed to the dev server's stdout, so
 * the sequence — and where it stops — can be read with `podman logs v10r`.
 */
export const POST: RequestHandler = async ({ request }) => {
	console.log(`[keyboard-diagnostics] ${await request.text()}`);
	return new Response(null, { status: 204 });
};
