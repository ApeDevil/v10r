import * as v from 'valibot';
import { getActiveProviderInfo, loadProviderRegistry } from '$lib/server/ai';
import { clearUserPreference, setUserPreference } from '$lib/server/ai/providers';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/http/body';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/http/response';
import { AI_PROVIDER_IDS } from '$lib/types/db-enums';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:ai:providers:switch', 60, '1 m');

const SwitchSchema = v.object({
	providerId: v.nullable(v.picklist(AI_PROVIDER_IDS)),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const read = await readJsonBounded(request, MAX_AI_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_AI_BODY_BYTES);
		return apiError(400, 'invalid_body', 'Request body must be valid JSON.');
	}
	const body = read.value;

	const parsed = v.safeParse(SwitchSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { providerId } = parsed.output;

	let registry: Awaited<ReturnType<typeof loadProviderRegistry>>;
	try {
		registry = await loadProviderRegistry();
	} catch {
		return apiError(503, 'ai_unavailable', 'AI settings are unavailable right now.');
	}

	if (providerId === null) {
		clearUserPreference(user.id);
	} else {
		// A preference may only name a provider the administrator has connected and enabled.
		const provider = registry.entries.find((p) => p.id === providerId && p.configured);
		if (!provider) return apiError(400, 'invalid_provider', `Provider "${providerId}" is not available.`);
		setUserPreference(user.id, providerId);
	}

	const activeInfo = getActiveProviderInfo(registry, user.id);
	return apiOk({
		activeId: activeInfo?.id ?? null,
		name: activeInfo?.name ?? null,
		model: activeInfo?.model ?? null,
	});
};
