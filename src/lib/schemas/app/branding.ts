import * as v from 'valibot';
import { PALETTE_IDS } from '$lib/styles/random/palette-registry';
import { TYPOGRAPHY_IDS } from '$lib/styles/random/typography-registry';
import { RADIUS_IDS } from '$lib/styles/random/radius-registry';

export const brandSettingsSchema = v.object({
	paletteId: v.picklist(PALETTE_IDS, 'Select a palette'),
	typographyId: v.picklist(TYPOGRAPHY_IDS, 'Select a typography'),
	radiusId: v.picklist(RADIUS_IDS, 'Select a shape'),
	enabled: v.optional(v.boolean(), false),
});

export type BrandSettingsInput = v.InferInput<typeof brandSettingsSchema>;
export type BrandSettingsOutput = v.InferOutput<typeof brandSettingsSchema>;
