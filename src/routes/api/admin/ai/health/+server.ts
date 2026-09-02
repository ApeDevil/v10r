/**
 * Admin AI health poll — volatile provider + circuit-breaker state.
 *
 * Pure in-memory / config reads only. MUST NOT make a real model call to verify
 * connectivity — that would burn the gemini free-tier quota (~20 req/day) and
 * 503 the live chat surfaces. Ships `cooldownUntil` as an ISO string so the
 * client ticks the countdown locally (no per-second polling).
 */
import { getActiveProviderInfo, getToolProvider } from '$lib/server/ai';
import { buildProviderRegistry, getCooldownResumeAt } from '$lib/server/ai/providers';
import { requireAdmin } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limit = createLimiter('rl:admin:ai:health', 60, '60 s');

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await limit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const registry = buildProviderRegistry();
	const active = getActiveProviderInfo();
	const tool = getToolProvider();

	const providers = await Promise.all(
		registry.map(async (p) => {
			const cooldownUntil = await getCooldownResumeAt(p.id);
			return {
				id: p.id,
				name: p.name,
				configured: p.configured,
				model: p.model,
				envVar: p.envVar,
				supportsTools: p.supportsTools,
				cooledDown: cooldownUntil !== null,
				cooldownUntil,
			};
		}),
	);

	setHeaders({ 'Cache-Control': 'no-store' });

	return apiOk({
		providers,
		activeProvider: active ? { id: active.id, name: active.name, model: active.model } : null,
		toolProvider: tool ? { id: tool.id, name: tool.name, model: tool.model } : null,
		aiAvailable: active != null,
		serverTime: new Date().toISOString(),
	});
};
