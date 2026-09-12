/**
 * Admin AI health poll — the saved provider connections plus volatile circuit-breaker
 * state.
 *
 * Reads settings and breaker state only. MUST NOT make a real model call to verify
 * connectivity — that would burn the gemini free-tier quota (~20 req/day) and 503 the
 * live chat surfaces; the admin's explicit connection test is the one place a probe
 * runs. Ships `cooldownUntil` as an ISO string so the client ticks the countdown
 * locally (no per-second polling).
 */
import { getActiveProviderInfo, getToolProvider, loadProviderRegistry, publicProviderConnection } from '$lib/server/ai';
import { getCooldownResumeAt } from '$lib/server/ai/providers';
import { requireAdmin } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limit = createLimiter('rl:admin:ai:health', 60, '60 s');

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await limit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	setHeaders({ 'Cache-Control': 'no-store' });

	let registry: Awaited<ReturnType<typeof loadProviderRegistry>>;
	try {
		registry = await loadProviderRegistry();
	} catch {
		return apiError(503, 'ai_settings_unavailable', 'AI settings could not be read.');
	}
	const active = getActiveProviderInfo(registry);
	const tool = getToolProvider(registry);

	const providers = await Promise.all(
		registry.entries.map(async (p) => {
			const cooldownUntil = await getCooldownResumeAt(p.id);
			return { ...publicProviderConnection(p), cooledDown: cooldownUntil !== null, cooldownUntil };
		}),
	);

	return apiOk({
		providers,
		activeProvider: active,
		toolProvider: tool ? { id: tool.id, name: tool.name, model: tool.modelId } : null,
		aiAvailable: active != null,
		degraded: registry.degraded,
		serverTime: new Date().toISOString(),
	});
};
