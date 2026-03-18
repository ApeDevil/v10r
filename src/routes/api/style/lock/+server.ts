/**
 * POST /api/style/lock — Toggle style lock on/off.
 * Updates both cookie and DB for auth users.
 */

import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { LockRequestSchema } from '$lib/schemas/style';
import { saveStyleToDb } from '$lib/server/style/persist';
import { parseStyleCookie, STYLE_COOKIE_NAME, STYLE_COOKIE_OPTIONS, serializeStyleCookie } from '$lib/styles/random';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const result = v.safeParse(LockRequestSchema, body);
	if (!result.success) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const current = parseStyleCookie(cookies.get(STYLE_COOKIE_NAME));
	if (!current) {
		return json({ error: 'No style cookie found' }, { status: 400 });
	}

	current.locked = result.output.locked;
	cookies.set(STYLE_COOKIE_NAME, serializeStyleCookie(current), STYLE_COOKIE_OPTIONS);

	// Fire-and-forget DB persistence for authenticated users
	if (locals.user) {
		saveStyleToDb(locals.user.id, current).catch(() => {});
	}

	return json({ success: true, locked: current.locked });
};
