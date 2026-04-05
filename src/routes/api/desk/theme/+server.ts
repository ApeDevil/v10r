import * as v from 'valibot';
import { requireApiUser } from '$lib/server/auth/guards';
import { saveDeskTheme, createDeskPreset, migrateDeskTheme } from '$lib/server/desk';
import { SaveThemeSchema, MigrateThemeSchema, CreatePresetSchema } from '$lib/server/desk/schemas';
import { apiOk, apiError, apiValidationError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

/** Save the user's active desk theme. */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	const { user } = requireApiUser(locals);

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
