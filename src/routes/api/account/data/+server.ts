/**
 * GET /api/account/data — machine-readable personal data report (GDPR Art 15).
 * Same aggregator as the /account/data page and the export download —
 * one definition of "all my data" across every surface.
 */

import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiOk } from '$lib/server/http/response';
import { collectUserData } from '$lib/server/privacy';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:me-data', 10, '1m');

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user, session } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	setHeaders({ 'Cache-Control': 'no-store, private' });

	const report = await collectUserData(user.id, { currentSessionId: session.id });
	return apiOk(report);
};
