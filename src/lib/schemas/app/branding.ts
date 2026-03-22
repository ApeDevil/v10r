import * as v from 'valibot';
import { PALETTE_IDS } from '$lib/styles/random/palette-registry';
import { TYPOGRAPHY_IDS } from '$lib/styles/random/typography-registry';
import { RADIUS_IDS } from '$lib/styles/random/radius-registry';

export const brandSettingsSchema = v.object({
	paletteId: v.pipe(
		v.string('Select a palette'),
		v.check(
			(val) => PALETTE_IDS.includes(val as (typeof PALETTE_IDS)[number]) || val.startsWith('CP_'),
			'Must be a preset palette or custom palette ID',
		),
	),
	typographyId: v.picklist(TYPOGRAPHY_IDS, 'Select a typography'),
	radiusId: v.picklist(RADIUS_IDS, 'Select a shape'),
	enabled: v.optional(v.boolean(), false),
});

export type BrandSettingsInput = v.InferInput<typeof brandSettingsSchema>;
export type BrandSettingsOutput = v.InferOutput<typeof brandSettingsSchema>;

// ── Custom Palettes ─────────────────────────────────────────────────

/** OKLCH color string validator */
const oklchColor = v.pipe(
	v.string(),
	v.regex(/^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/, 'Must be a valid oklch() color'),
);

/** All 20 palette color tokens */
export const paletteColorsSchema = v.object({
	bg: oklchColor,
	fg: oklchColor,
	body: oklchColor,
	heading: oklchColor,
	muted: oklchColor,
	border: oklchColor,
	subtle: oklchColor,
	primary: oklchColor,
	'primary-hover': oklchColor,
	'primary-container': oklchColor,
	'on-primary-container': oklchColor,
	'primary-dim': oklchColor,
	'on-primary': oklchColor,
	secondary: oklchColor,
	'on-secondary': oklchColor,
	accent: v.optional(oklchColor),
	'accent-hover': v.optional(oklchColor),
	'on-accent': v.optional(oklchColor),
	'accent-container': v.optional(oklchColor),
	'on-accent-container': v.optional(oklchColor),
	input: oklchColor,
	'input-border': oklchColor,
	'surface-1': oklchColor,
	'surface-2': oklchColor,
	'surface-3': oklchColor,
});

export const customPaletteSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Name is required'), v.maxLength(50)),
	description: v.optional(v.pipe(v.string(), v.maxLength(200)), ''),
	basePaletteId: v.string(),
	accentOffset: v.optional(v.pipe(v.number(), v.minValue(-60), v.maxValue(60)), 0),
	lightColors: paletteColorsSchema,
	darkColors: paletteColorsSchema,
});

export type CustomPaletteInput = v.InferInput<typeof customPaletteSchema>;
