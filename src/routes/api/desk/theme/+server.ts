import * as v from 'valibot';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import { createDeskPreset, migrateDeskTheme, saveDeskTheme } from '$lib/server/desk';
import { CreatePresetSchema, MigrateThemeSchema, SaveThemeSchema } from '$lib/server/desk/schemas';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:theme', 30, '1 m');

/** Save the user's active desk theme. */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(SaveThemeSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	await saveDeskTheme(user.id, {
		workspace: parsed.output.workspace,
		typeStyles: parsed.output.typeStyles ?? {},
		activePresetId: parsed.output.activePresetId ?? null,
	});

	return apiOk({ saved: true });
};

/** Create a preset or migrate from localStorage. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = requireApiUser(locals);

	const { success: rlOk, reset } = await limiter.limit(user.id);
	if (!rlOk) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	if (body.action === 'migrate') {
		const parsed = v.safeParse(MigrateThemeSchema, body);
		if (!parsed.success) return apiValidationError(parsed.issues);

		const migrated = await migrateDeskTheme(user.id, {
			workspace: parsed.output.workspace ?? {},
			typeStyles: parsed.output.typeStyles ?? {},
			activePresetId: parsed.output.activePresetId ?? null,
			userPresets: Array.isArray(parsed.output.userPresets) ? parsed.output.userPresets : [],
		});
		return apiOk({ migrated });
	}

	if (body.action === 'create-preset') {
		const parsed = v.safeParse(CreatePresetSchema, body);
		if (!parsed.success) return apiValidationError(parsed.issues);

		const preset = await createDeskPreset(user.id, {
			name: parsed.output.name,
			workspace: parsed.output.workspace ?? {},
			typeStyles: parsed.output.typeStyles ?? {},
		});
		return apiOk({ preset: { id: preset.id, name: preset.name } });
	}

	return apiError(400, 'unknown_action', 'Unknown action');
};
