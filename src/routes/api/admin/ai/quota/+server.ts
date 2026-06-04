/**
 * Admin provider-quota poll — documented limits ⨝ today's observed usage ⨝
 * circuit-breaker state, assembled by buildProviderQuota().
 *
 * Separate from /health because this does a DB aggregate (different cost class
 * than health's pure in-memory reads), so it gets its own rate-limit bucket.
 * Like /health it MUST NOT make a real generation call — reading about quota
 * must never spend quota. Ships absolute ISO timestamps (resetAt, cooldownUntil)
 * for the client to tick locally.
 */
import { buildProviderQuota } from '$lib/server/ai/quota';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk } from '$lib/server/api/response';
import { requireAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limit = createLimiter('rl:admin:ai:quota', 30, '60 s');

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await limit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const quota = await buildProviderQuota();

	setHeaders({ 'Cache-Control': 'no-store' });

	return apiOk({ quota, serverTime: new Date().toISOString() });
};
