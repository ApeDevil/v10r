/**
 * Random style generation and resolution.
 */

import { getPalette, PALETTE_IDS, PALETTE_REGISTRY } from './palette-registry';
import type { PaletteId, ResolvedStyle, StyleConfig, TypographyId } from './types';
import { getTypography, TYPOGRAPHY_IDS } from './typography-registry';

interface GenerateOptions {
	/** Exclude these palette IDs from selection */
	excludePaletteIds?: PaletteId[];
	/** Exclude these typography IDs from selection */
	excludeTypographyIds?: TypographyId[];
	/** Prefer high-contrast palettes (for prefers-contrast: more) */
	highContrast?: boolean;
}

function pickRandom<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

/**
 * Generate a random style config.
 * Excludes provided IDs to avoid same-style re-rolls.
 */
export function generateRandomStyle(opts?: GenerateOptions): StyleConfig {
	let palettePool: readonly PaletteId[];

	if (opts?.highContrast) {
		// Only pick from high-contrast palettes
		const hcIds = PALETTE_REGISTRY.filter((p) => p.highContrast).map((p) => p.id);
		palettePool = hcIds.length > 0 ? hcIds : PALETTE_IDS;
	} else {
		palettePool = PALETTE_IDS;
	}

	// Filter out excluded palettes
	if (opts?.excludePaletteIds?.length) {
		const filtered = palettePool.filter((id) => !opts.excludePaletteIds?.includes(id));
		if (filtered.length > 0) palettePool = filtered;
	}

	let typographyPool: readonly TypographyId[] = TYPOGRAPHY_IDS;
	if (opts?.excludeTypographyIds?.length) {
		const filtered = typographyPool.filter((id) => !opts.excludeTypographyIds?.includes(id));
		if (filtered.length > 0) typographyPool = filtered;
	}

	return {
		paletteId: pickRandom(palettePool),
		typographyId: pickRandom(typographyPool),
		locked: false,
	};
}

/**
 * Resolve a StyleConfig into a ResolvedStyle with display names.
 * Returns null if palette or typography ID is not found in registries.
 */
export function resolveStyle(config: StyleConfig): ResolvedStyle | null {
	const palette = getPalette(config.paletteId);
	const typography = getTypography(config.typographyId);

	if (!palette || !typography) return null;

	return {
		paletteId: config.paletteId,
		typographyId: config.typographyId,
		paletteName: palette.name,
		typographyName: typography.name,
		locked: config.locked,
	};
}
