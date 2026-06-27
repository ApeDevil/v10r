import { getBrandSettings } from '$lib/server/db/brand/queries';
import type { PaletteId, RadiusId, StyleConfig, TypographyId } from '$lib/styles/random/types';

let cached: { style: StyleConfig; enabled: boolean } | null = null;
let resolved = false; // distinguishes "not loaded yet" from "loaded, no brand row"
let loading: Promise<{ style: StyleConfig; enabled: boolean } | null> | null = null;

/**
 * Get brand config from cache (0ms) or DB (cold start). The NULL result (no brand
 * row configured) is cached too — otherwise every request re-queries Neon. A
 * transient DB error is NOT cached (the promise rejects, `resolved` stays false)
 * so the next request retries.
 */
export async function getBrandConfig() {
	if (resolved) return cached;
	if (loading) return loading;

	loading = (async () => {
		const row = await getBrandSettings();
		cached = row
			? {
					style: {
						paletteId: row.paletteId as PaletteId,
						typographyId: row.typographyId as TypographyId,
						radiusId: row.radiusId as RadiusId,
					},
					enabled: row.enabled,
				}
			: null;
		resolved = true;
		return cached;
	})();

	try {
		return await loading;
	} finally {
		loading = null;
	}
}

/** Invalidate cache — call after admin saves brand settings. */
export function invalidateBrandCache() {
	cached = null;
	resolved = false;
	loading = null;
}
