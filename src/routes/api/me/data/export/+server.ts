/**
 * GET /api/me/data/export — full personal data report as a JSON download
 * (GDPR Art 20 portability for consent/contract domains; per-domain
 * `portable` flags in the report mark which sections Art 20 covers).
 * Plain <a href> target — no fetch/toast ceremony needed in the UI.
 */
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { guardApiUser } from '$lib/server/auth/guards';
import { collectUserData } from '$lib/server/privacy';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:me-export', 5, '1m');

export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user, session } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const report = await collectUserData(user.id, { currentSessionId: session.id });
	const date = new Date().toISOString().slice(0, 10);

	return new Response(JSON.stringify(report, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="v10r-export-${date}.json"`,
			'Cache-Control': 'no-store, private',
		},
	});
};
