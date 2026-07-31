/**
 * Style persistence — read/write style preferences to/from the database.
 */

import type { StyleConfig } from '$lib/styles/random/types';
import { updatePreferences } from '../db/preferences/mutations';

/** Save style preferences to DB. Fire-and-forget. */
export async function saveStyleToDb(userId: string, config: StyleConfig) {
	await updatePreferences(userId, {
		paletteId: config.paletteId,
		typographyId: config.typographyId,
		radiusId: config.radiusId,
	});
}
