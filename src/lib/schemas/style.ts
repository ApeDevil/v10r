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
	lck: v.boolean(),
	v: v.literal(1),
});

export const RollRequestSchema = v.object({
	highContrast: v.optional(v.boolean(), false),
});

export const LockRequestSchema = v.object({
	locked: v.boolean(),
});
