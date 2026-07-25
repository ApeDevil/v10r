/**
 * Valibot schemas for style randomizer API validation.
 */

import * as v from 'valibot';
import { PALETTE_IDS } from '$lib/styles/random/palette-registry';
import { RADIUS_IDS } from '$lib/styles/random/radius-registry';
import { TYPOGRAPHY_IDS } from '$lib/styles/random/typography-registry';

export const PaletteIdSchema = v.picklist(PALETTE_IDS);
export const TypographyIdSchema = v.picklist(TYPOGRAPHY_IDS);
export const RadiusIdSchema = v.picklist(RADIUS_IDS);

export const StyleCookieSchema = v.object({
	pid: PaletteIdSchema,
	tid: TypographyIdSchema,
	rid: RadiusIdSchema,
	v: v.literal(1),
});

export const RollRequestSchema = v.object({
	highContrast: v.optional(v.boolean(), false),
});

/**
 * Custom palette id shape — mirrors createId.palette() (`CP_` + 12 hex chars).
 * Checking the shape here bounds the input before any DB lookup, so a forged
 * cookie or request body cannot be used to probe with arbitrary-length strings.
 */
export const CustomPaletteIdSchema = v.pipe(v.string(), v.regex(/^CP_[0-9a-f]{12}$/));

/**
 * A partial style pick. Every field is optional and merges onto the visitor's
 * current cookie, so picking a typography set leaves palette and shape alone.
 * At least one field must be present — an empty body is a no-op, not a request.
 */
export const StylePickSchema = v.pipe(
	v.object({
		paletteId: v.optional(v.union([PaletteIdSchema, CustomPaletteIdSchema])),
		typographyId: v.optional(TypographyIdSchema),
		radiusId: v.optional(RadiusIdSchema),
	}),
	v.check(
		(o) => Boolean(o.paletteId ?? o.typographyId ?? o.radiusId),
		'Pick at least one of paletteId, typographyId or radiusId',
	),
);
