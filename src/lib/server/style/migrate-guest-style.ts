/**
 * Guest-to-user style migration.
 * When a guest logs in, their cookie style is saved to the DB if the user has no saved style.
 */

import type { Cookies } from '@sveltejs/kit';
import { parseStyleCookie, STYLE_COOKIE_NAME } from '$lib/styles/random';
import { loadStyleFromDb, saveStyleToDb } from './persist';

/** Migrate guest style from cookie to DB. Fire-and-forget, safe to call multiple times. */
export async function migrateGuestStyle(userId: string, cookies: Cookies) {
	const cookieValue = cookies.get(STYLE_COOKIE_NAME);
	const config = parseStyleCookie(cookieValue);
	if (!config) return;

	const existing = await loadStyleFromDb(userId);
	if (existing) return; // User already has a saved style

	await saveStyleToDb(userId, config);
}
