/**
 * Style persistence — read/write style preferences to/from the database.
 */

import type { PaletteId, RadiusId, StyleConfig, TypographyId } from '$lib/styles/random/types';
import { getOrCreatePreferences, updatePreferences } from '../db/preferences/mutations';

/** Save style preferences to DB. Fire-and-forget. */
export async function saveStyleToDb(userId: string, config: StyleConfig) {
	await updatePreferences(userId, {
		paletteId: config.paletteId,
		typographyId: config.typographyId,
		radiusId: config.radiusId,
	});
}

/** Load style preferences from DB. Returns null if no style saved. */
export async function loadStyleFromDb(userId: string): Promise<StyleConfig | null> {
	const prefs = await getOrCreatePreferences(userId);
	if (!prefs?.paletteId || !prefs?.typographyId) return null;

	return {
		paletteId: prefs.paletteId as PaletteId,
		typographyId: prefs.typographyId as TypographyId,
		radiusId: (prefs.radiusId ?? 'R2') as RadiusId,
	};
}
