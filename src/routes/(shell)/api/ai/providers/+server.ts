import { getActiveProviderInfo, providerRegistry } from '$lib/server/ai';
import { getCooldownResumeAt, getUserPreference } from '$lib/server/ai/providers';
import { apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const providers = providerRegistry.map((p) => ({
		id: p.id,
		name: p.name,
		model: p.model,
		configured: p.configured,
		supportsTools: p.supportsTools,
		cooldownUntil: p.configured ? getCooldownResumeAt(p.id) : null,
	}));

	const activeInfo = getActiveProviderInfo(user.id);

	return apiOk({
		providers,
		activeId: activeInfo?.id ?? null,
		preference: getUserPreference(user.id),
	});
};
