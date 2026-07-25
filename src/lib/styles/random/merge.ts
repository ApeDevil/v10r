import type { RadiusId, StyleConfig, TypographyId } from './types';

/**
 * A partial pick — any subset of the three style dimensions.
 *
 * `paletteId` is a plain string rather than `PaletteId` because a custom palette
 * id (`CP_…`) is valid at runtime but deliberately outside the preset union.
 */
export type StylePatch = {
	paletteId?: string;
	typographyId?: TypographyId;
	radiusId?: RadiusId;
};

/**
 * Merge a pick onto an existing style.
 *
 * Picking is per-dimension: choosing a typography set must leave the visitor's
 * palette and shape untouched. `undefined` fields are dropped rather than
 * spread, so `{ ...base, ...patch }` cannot blank a dimension the caller left out.
 */
export function mergeStyleConfig(base: StyleConfig, patch: StylePatch): StyleConfig {
	return {
		// Same widening the loadStyle hook performs for CP_ ids.
		paletteId: (patch.paletteId ?? base.paletteId) as StyleConfig['paletteId'],
		typographyId: patch.typographyId ?? base.typographyId,
		radiusId: patch.radiusId ?? base.radiusId,
	};
}
