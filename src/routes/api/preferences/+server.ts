import { json } from '@sveltejs/kit';
import { updatePreferences } from '$lib/server/db/preferences/mutations';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();

	// Only allow theme updates from this lightweight endpoint
	const theme = body.theme;
	if (!theme || !['light', 'dark', 'system'].includes(theme)) {
		return json({ error: 'Invalid theme' }, { status: 400 });
	}

	await updatePreferences(locals.user.id, { theme });

	return json({ ok: true });
};
