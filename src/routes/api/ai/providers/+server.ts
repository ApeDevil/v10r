import { getActiveProviderInfo, providerRegistry } from '$lib/server/ai';
import { getCooldownResumeAt, getUserPreference } from '$lib/server/ai/providers';
import { guardApiUser } from '$lib/server/http/guards';
import { apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const providers = await Promise.all(
		providerRegistry.map(async (p) => ({
			id: p.id,
			name: p.name,
			model: p.model,
			configured: p.configured,
			supportsTools: p.supportsTools,
			cooldownUntil: p.configured ? await getCooldownResumeAt(p.id) : null,
		})),
	);

	const activeInfo = getActiveProviderInfo(user.id);

	return apiOk({
		providers,
		activeId: activeInfo?.id ?? null,
		preference: getUserPreference(user.id),
	});
};
