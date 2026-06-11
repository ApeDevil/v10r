/**
 * GET /api/me/data — machine-readable personal data report (GDPR Art 15).
 * Same aggregator as the /app/account/data page and the export download —
 * one definition of "all my data" across every surface.
 */
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { collectUserData } from '$lib/server/privacy';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:me-data', 10, '1m');

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const { user, session } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	setHeaders({ 'Cache-Control': 'no-store, private' });

	const report = await collectUserData(user.id, { currentSessionId: session.id });
	return apiOk(report);
};
