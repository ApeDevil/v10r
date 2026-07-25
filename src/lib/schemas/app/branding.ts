import * as v from 'valibot';

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
