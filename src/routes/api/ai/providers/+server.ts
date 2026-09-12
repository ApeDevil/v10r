import { getActiveProviderInfo, loadProviderRegistry } from '$lib/server/ai';
import { getCooldownResumeAt, getUserPreference } from '$lib/server/ai/providers';
import { guardApiUser } from '$lib/server/http/guards';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

/**
 * The desk's provider picker. Lists every provider (connected or not) so the picker can
 * show what is available, with the wire shape the client already reads — `model`,
 * `supportsTools` — and nothing about keys beyond `configured`.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	let registry: Awaited<ReturnType<typeof loadProviderRegistry>>;
	try {
		registry = await loadProviderRegistry();
	} catch {
		return apiError(503, 'ai_unavailable', 'AI settings are unavailable right now.');
	}

	const providers = await Promise.all(
		registry.entries.map(async (p) => ({
			id: p.id,
			name: p.name,
			model: p.modelId,
			configured: p.configured,
			supportsTools: p.capabilities.tools,
			cooldownUntil: p.configured ? await getCooldownResumeAt(p.id) : null,
		})),
	);

	const activeInfo = getActiveProviderInfo(registry, user.id);

	return apiOk({
		providers,
		activeId: activeInfo?.id ?? null,
		preference: getUserPreference(user.id),
	});
};
