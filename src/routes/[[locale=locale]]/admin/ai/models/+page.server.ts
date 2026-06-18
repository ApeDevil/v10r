import { getActiveProviderInfo, getFallbacksForUser, getToolProvider } from '$lib/server/ai';
import { buildProviderRegistry, getCooldownResumeAt } from '$lib/server/ai/providers';
import { requireAdmin } from '$lib/server/auth/guards';
import type { PageServerLoad } from './$types';

/**
 * Models & Routing — reads the SAME provider facade the orchestrator uses (single
 * door: never recompute "which provider is active" in admin code). Provider config
 * + routing are static; cooldown is volatile in-memory state, shipped as an ISO
 * timestamp so the client ticks the countdown locally (no per-second polling).
 *
 * Per-model token usage moved to the cross-surface Cost tab (/admin/ai/cost) — this
 * tab is provider routing/config only.
 */
export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const registry = buildProviderRegistry();
	const active = getActiveProviderInfo();
	const tool = getToolProvider();
	const fallbacks = getFallbacksForUser();

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

	return {
		title: 'Models & Routing',
		providerDetail: providers,
		activeProviderId: active?.id ?? null,
		toolProviderId: tool?.id ?? null,
		fallbackIds: fallbacks.map((f) => f.id),
	};
};
