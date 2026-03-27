import { json } from '@sveltejs/kit';
import { updatePreferences } from '$lib/server/db/preferences/mutations';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const updates: Record<string, unknown> = {};

	// Theme
	if (body.theme && ['light', 'dark', 'system'].includes(body.theme)) {
		updates.theme = body.theme;
	}

	// Sidebar width
	if (typeof body.sidebarWidth === 'number' && body.sidebarWidth >= 160 && body.sidebarWidth <= 320) {
		updates.sidebarWidth = body.sidebarWidth;
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields' }, { status: 400 });
	}

	await updatePreferences(locals.user.id, updates);

	return json({ ok: true });
};
