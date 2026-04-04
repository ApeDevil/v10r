import { json } from '@sveltejs/kit';
import { saveDeskTheme, createDeskPreset, deleteDeskPreset, migrateDeskTheme } from '$lib/server/db/desk/theme-mutations';
import type { RequestHandler } from './$types';

/** Save the user's active desk theme. */
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json();
	if (!body.workspace || typeof body.workspace !== 'object') {
		return json({ error: 'Invalid workspace' }, { status: 400 });
	}

	await saveDeskTheme(locals.user.id, {
		workspace: body.workspace,
		typeStyles: body.typeStyles ?? {},
		activePresetId: body.activePresetId ?? null,
	});

	return json({ ok: true });
};

/** Create a preset or migrate from localStorage. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json();

	// Migration from localStorage
	if (body.action === 'migrate') {
		const migrated = await migrateDeskTheme(locals.user.id, {
			workspace: body.workspace ?? {},
			typeStyles: body.typeStyles ?? {},
			activePresetId: body.activePresetId ?? null,
			userPresets: Array.isArray(body.userPresets) ? body.userPresets : [],
		});
		return json({ ok: true, migrated });
	}

	// Create preset
	if (body.action === 'create-preset') {
		if (!body.name || typeof body.name !== 'string') {
			return json({ error: 'Name required' }, { status: 400 });
		}
		const preset = await createDeskPreset(locals.user.id, {
			name: body.name,
			workspace: body.workspace ?? {},
			typeStyles: body.typeStyles ?? {},
		});
		return json({ ok: true, preset: { id: preset.id, name: preset.name } });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};

/** Delete a user preset. */
export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json();
	if (!body.id || typeof body.id !== 'string') {
		return json({ error: 'Preset ID required' }, { status: 400 });
	}

	const deleted = await deleteDeskPreset(body.id, locals.user.id);
	if (!deleted) return json({ error: 'Not found' }, { status: 404 });

	return json({ ok: true });
};
