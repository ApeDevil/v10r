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
import { loadProviderRegistry } from '$lib/server/ai';
import { buildProviderQuota } from '$lib/server/ai/quota';
import { requireAdmin } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limit = createLimiter('rl:admin:ai:quota', 30, '60 s');

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await limit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	let quota: Awaited<ReturnType<typeof buildProviderQuota>>;
	try {
		quota = await buildProviderQuota(await loadProviderRegistry());
	} catch {
		return apiError(503, 'ai_settings_unavailable', 'AI settings could not be read.');
	}

	setHeaders({ 'Cache-Control': 'no-store' });

	return apiOk({ quota, serverTime: new Date().toISOString() });
};
