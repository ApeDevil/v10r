import type { PaletteId, RadiusId, StyleConfig, TypographyId } from '$lib/styles/random/types';
import { getBrandSettings } from '$lib/server/db/brand/queries';

let cached: { style: StyleConfig; enabled: boolean } | null = null;
let loading: Promise<{ style: StyleConfig; enabled: boolean } | null> | null = null;

/** Get corporate config from cache (0ms) or DB (cold start). */
export async function getCorporateConfig() {
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
export function invalidateCorporateCache() {
	cached = null;
	loading = null;
}
