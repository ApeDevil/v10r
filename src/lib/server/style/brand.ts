import { getBrandSettings } from '$lib/server/db/brand/queries';
import type { PaletteId, RadiusId, StyleConfig, TypographyId } from '$lib/styles/random/types';

let cached: { style: StyleConfig; enabled: boolean } | null = null;
let loading: Promise<{ style: StyleConfig; enabled: boolean } | null> | null = null;

/** Get brand config from cache (0ms) or DB (cold start). */
export async function getBrandConfig() {
	if (cached) return cached;
	if (loading) return loading;

	loading = (async () => {
		const row = await getBrandSettings();
		if (!row) return null;
		cached = {
			style: {
				paletteId: row.paletteId as PaletteId,
				typographyId: row.typographyId as TypographyId,
				radiusId: row.radiusId as RadiusId,
			},
			enabled: row.enabled,
		};
		return cached;
	})();

	try {
		const result = await loading;
		return result;
	} finally {
		loading = null;
	}
}

/** Invalidate cache — call after admin saves brand settings. */
export function invalidateBrandCache() {
	cached = null;
	loading = null;
}
