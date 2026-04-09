import * as v from 'valibot';
import { apiError, apiNoContent, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { updatePreferences } from '$lib/server/preferences';
import { UpdatePreferencesSchema } from '$lib/server/preferences/schemas';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(UpdatePreferencesSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	await updatePreferences(user.id, parsed.output);

	return apiNoContent();
};
