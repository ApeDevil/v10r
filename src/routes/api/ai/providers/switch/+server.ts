import * as v from 'valibot';
import { getActiveProviderInfo, providerRegistry } from '$lib/server/ai';
import { clearUserPreference, setUserPreference } from '$lib/server/ai/providers';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:ai:providers:switch', 60, '1 m');

const SwitchSchema = v.object({
	providerId: v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(20))),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(SwitchSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { providerId } = parsed.output;

	if (providerId === null) {
		clearUserPreference(user.id);
	} else {
		const provider = providerRegistry.find((p) => p.id === providerId && p.configured);
		if (!provider) return apiError(400, 'invalid_provider', `Provider "${providerId}" is not available.`);
		setUserPreference(user.id, providerId);
	}

	const activeInfo = getActiveProviderInfo(user.id);
	return apiOk({
		activeId: activeInfo?.id ?? null,
		name: activeInfo?.name ?? null,
		model: activeInfo?.model ?? null,
	});
};
