import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent, apiValidationError } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import { updatePreferences } from '$lib/server/preferences';
import { UpdatePreferencesSchema } from '$lib/server/preferences/schemas';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:preferences', 60, '1 m');

export const POST: RequestHandler = async ({ locals, request }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(UpdatePreferencesSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	await updatePreferences(user.id, parsed.output);

	return apiNoContent();
};
