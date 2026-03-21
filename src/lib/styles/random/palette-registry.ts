/**
 * Static palette registry — OKLCH color definitions for each palette.
 * Build-time WCAG validation runs at import.
 */

import { validatePaletteContrast } from './contrast';
import type { Palette, PaletteColors, PaletteId } from './types';

function defineColors(c: PaletteColors): PaletteColors {
	return c;
}

/**
 * P0 — High Contrast (WCAG AAA, auto-selected for prefers-contrast: more)
 */
const P0: Palette = {
	id: 'P0' as PaletteId,
	name: 'High Contrast',
	description: 'Maximum contrast for accessibility. WCAG AAA compliant.',
	highContrast: true,
	light: defineColors({
		bg: 'oklch(0.97 0 0)',
		fg: 'oklch(0.13 0 0)',
		body: 'oklch(0.13 0 0)',
		heading: 'oklch(0.13 0 0)',
		muted: 'oklch(0.35 0 0)',
		border: 'oklch(0.20 0 0)',
		subtle: 'oklch(0.93 0 0)',
		primary: 'oklch(0.40 0.15 265)',
		'primary-hover': 'oklch(0.35 0.17 265)',
		'primary-container': 'oklch(0.92 0.03 265)',
		'on-primary-container': 'oklch(0.15 0.05 265)',
		'primary-dim': 'oklch(0.70 0.10 265)',
		'on-primary': 'oklch(0.97 0 0)',
		secondary: 'oklch(0.90 0 0)',
		'on-secondary': 'oklch(0.15 0 0)',
		input: 'oklch(0.98 0 0)',
		'input-border': 'oklch(0.30 0 0)',
		'surface-1': 'oklch(0.98 0 0)',
		'surface-2': 'oklch(0.99 0 0)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.10 0 0)',
		fg: 'oklch(0.95 0 0)',
		body: 'oklch(0.95 0 0)',
		heading: 'oklch(0.95 0 0)',
		muted: 'oklch(0.72 0 0)',
		border: 'oklch(0.85 0 0)',
		subtle: 'oklch(0.15 0 0)',
		primary: 'oklch(0.72 0.14 265)',
		'primary-hover': 'oklch(0.78 0.12 265)',
		'primary-container': 'oklch(0.25 0.08 265)',
		'on-primary-container': 'oklch(0.95 0.02 265)',
		'primary-dim': 'oklch(0.35 0.10 265)',
		'on-primary': 'oklch(0.10 0 0)',
		secondary: 'oklch(0.15 0 0)',
		'on-secondary': 'oklch(0.92 0 0)',
		input: 'oklch(0.08 0 0)',
		'input-border': 'oklch(0.75 0 0)',
		'surface-1': 'oklch(0.08 0 0)',
		'surface-2': 'oklch(0.06 0 0)',
		'surface-3': 'oklch(0.04 0 0)',
	}),
};

/**
 * P1 — Ocean
 */
const P1: Palette = {
	id: 'P1' as PaletteId,
	name: 'Ocean',
	description: 'Cool blues and teals inspired by deep water.',
	light: defineColors({
		bg: 'oklch(0.95 0.03 220)',
		fg: 'oklch(0.25 0.06 230)',
		body: 'oklch(0.28 0.05 225)',
		heading: 'oklch(0.25 0.06 230)',
		muted: 'oklch(0.50 0.05 220)',
		border: 'oklch(0.85 0.04 220)',
		subtle: 'oklch(0.93 0.03 220)',
		primary: 'oklch(0.50 0.14 230)',
		'primary-hover': 'oklch(0.44 0.16 230)',
		'primary-container': 'oklch(0.90 0.04 230)',
		'on-primary-container': 'oklch(0.22 0.08 230)',
		'primary-dim': 'oklch(0.65 0.10 230)',
		'on-primary': 'oklch(0.97 0.01 220)',
		secondary: 'oklch(0.88 0.02 200)',
		'on-secondary': 'oklch(0.25 0.06 200)',
		input: 'oklch(0.94 0.03 220)',
		'input-border': 'oklch(0.50 0.08 200)',
		'surface-1': 'oklch(0.96 0.025 220)',
		'surface-2': 'oklch(0.97 0.02 220)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.16 0.035 225)',
		fg: 'oklch(0.82 0.06 200)',
		body: 'oklch(0.78 0.05 210)',
		heading: 'oklch(0.82 0.06 200)',
		muted: 'oklch(0.62 0.05 220)',
		border: 'oklch(0.30 0.05 225)',
		subtle: 'oklch(0.20 0.035 225)',
		primary: 'oklch(0.65 0.12 225)',
		'primary-hover': 'oklch(0.72 0.10 225)',
		'primary-container': 'oklch(0.28 0.08 230)',
		'on-primary-container': 'oklch(0.90 0.03 220)',
		'primary-dim': 'oklch(0.32 0.08 230)',
		'on-primary': 'oklch(0.12 0.02 225)',
		secondary: 'oklch(0.18 0.02 210)',
		'on-secondary': 'oklch(0.78 0.06 210)',
		input: 'oklch(0.12 0.02 225)',
		'input-border': 'oklch(0.50 0.06 210)',
		'surface-1': 'oklch(0.14 0.03 225)',
		'surface-2': 'oklch(0.12 0.025 225)',
		'surface-3': 'oklch(0.08 0.01 225)',
	}),
};

/**
 * P2 — Sunset
 */
const P2: Palette = {
	id: 'P2' as PaletteId,
	name: 'Sunset',
	description: 'Warm oranges and amber tones.',
	light: defineColors({
		bg: 'oklch(0.96 0.03 60)',
		fg: 'oklch(0.25 0.06 30)',
		body: 'oklch(0.28 0.05 35)',
		heading: 'oklch(0.25 0.06 30)',
		muted: 'oklch(0.50 0.05 50)',
		border: 'oklch(0.85 0.05 55)',
		subtle: 'oklch(0.93 0.035 55)',
		primary: 'oklch(0.55 0.16 40)',
		'primary-hover': 'oklch(0.48 0.18 40)',
		'primary-container': 'oklch(0.92 0.04 45)',
		'on-primary-container': 'oklch(0.25 0.08 35)',
		'primary-dim': 'oklch(0.70 0.10 45)',
		'on-primary': 'oklch(0.98 0.01 50)',
		secondary: 'oklch(0.90 0.02 70)',
		'on-secondary': 'oklch(0.28 0.05 70)',
		input: 'oklch(0.95 0.03 55)',
		'input-border': 'oklch(0.52 0.08 45)',
		'surface-1': 'oklch(0.97 0.025 55)',
		'surface-2': 'oklch(0.98 0.02 55)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.15 0.035 40)',
		fg: 'oklch(0.85 0.05 50)',
		body: 'oklch(0.80 0.04 45)',
		heading: 'oklch(0.85 0.05 50)',
		muted: 'oklch(0.62 0.05 50)',
		border: 'oklch(0.30 0.05 45)',
		subtle: 'oklch(0.20 0.035 45)',
		primary: 'oklch(0.68 0.14 40)',
		'primary-hover': 'oklch(0.74 0.12 40)',
		'primary-container': 'oklch(0.28 0.08 40)',
		'on-primary-container': 'oklch(0.92 0.03 50)',
		'primary-dim': 'oklch(0.32 0.08 45)',
		'on-primary': 'oklch(0.12 0.02 40)',
		secondary: 'oklch(0.18 0.02 60)',
		'on-secondary': 'oklch(0.80 0.05 60)',
		input: 'oklch(0.12 0.02 40)',
		'input-border': 'oklch(0.52 0.06 45)',
		'surface-1': 'oklch(0.13 0.03 40)',
		'surface-2': 'oklch(0.11 0.025 40)',
		'surface-3': 'oklch(0.07 0.01 40)',
	}),
};

/**
 * P3 — Forest
 */
const P3: Palette = {
	id: 'P3' as PaletteId,
	name: 'Forest',
	description: 'Deep greens and earthy tones.',
	light: defineColors({
		bg: 'oklch(0.95 0.03 145)',
		fg: 'oklch(0.22 0.06 155)',
		body: 'oklch(0.26 0.05 150)',
		heading: 'oklch(0.22 0.06 155)',
		muted: 'oklch(0.48 0.05 145)',
		border: 'oklch(0.84 0.05 145)',
		subtle: 'oklch(0.92 0.035 145)',
		primary: 'oklch(0.48 0.12 155)',
		'primary-hover': 'oklch(0.42 0.14 155)',
		'primary-container': 'oklch(0.90 0.04 150)',
		'on-primary-container': 'oklch(0.20 0.07 155)',
		'primary-dim': 'oklch(0.62 0.08 150)',
		'on-primary': 'oklch(0.97 0.01 145)',
		secondary: 'oklch(0.89 0.02 130)',
		'on-secondary': 'oklch(0.25 0.05 130)',
		input: 'oklch(0.94 0.03 145)',
		'input-border': 'oklch(0.48 0.07 150)',
		'surface-1': 'oklch(0.96 0.025 145)',
		'surface-2': 'oklch(0.97 0.02 145)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.15 0.035 150)',
		fg: 'oklch(0.82 0.05 140)',
		body: 'oklch(0.78 0.04 145)',
		heading: 'oklch(0.82 0.05 140)',
		muted: 'oklch(0.60 0.05 145)',
		border: 'oklch(0.28 0.05 150)',
		subtle: 'oklch(0.19 0.035 150)',
		primary: 'oklch(0.62 0.10 150)',
		'primary-hover': 'oklch(0.68 0.08 150)',
		'primary-container': 'oklch(0.26 0.06 155)',
		'on-primary-container': 'oklch(0.90 0.03 145)',
		'primary-dim': 'oklch(0.30 0.06 150)',
		'on-primary': 'oklch(0.12 0.02 150)',
		secondary: 'oklch(0.17 0.02 135)',
		'on-secondary': 'oklch(0.78 0.05 135)',
		input: 'oklch(0.12 0.02 150)',
		'input-border': 'oklch(0.48 0.05 145)',
		'surface-1': 'oklch(0.13 0.03 150)',
		'surface-2': 'oklch(0.11 0.025 150)',
		'surface-3': 'oklch(0.07 0.01 150)',
	}),
};

/**
 * P4 — Neon Lime (high-chroma ~130° green)
 */
const P4: Palette = {
	id: 'P4' as PaletteId,
	name: 'Neon Lime',
	description: 'Vivid green, neobrutalist energy.',
	light: defineColors({
		bg: 'oklch(0.94 0.08 130)',
		fg: 'oklch(0.20 0.06 140)',
		body: 'oklch(0.24 0.05 135)',
		heading: 'oklch(0.20 0.06 140)',
		muted: 'oklch(0.45 0.04 130)',
		border: 'oklch(0.82 0.06 130)',
		subtle: 'oklch(0.91 0.06 130)',
		primary: 'oklch(0.55 0.20 135)',
		'primary-hover': 'oklch(0.48 0.22 135)',
		'primary-container': 'oklch(0.88 0.08 135)',
		'on-primary-container': 'oklch(0.18 0.08 140)',
		'primary-dim': 'oklch(0.68 0.14 135)',
		'on-primary': 'oklch(0.96 0.02 130)',
		secondary: 'oklch(0.86 0.05 120)',
		'on-secondary': 'oklch(0.22 0.06 120)',
		input: 'oklch(0.93 0.06 130)',
		'input-border': 'oklch(0.48 0.10 130)',
		'surface-1': 'oklch(0.95 0.06 130)',
		'surface-2': 'oklch(0.96 0.04 130)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.16 0.04 135)',
		fg: 'oklch(0.88 0.08 125)',
		body: 'oklch(0.82 0.06 130)',
		heading: 'oklch(0.88 0.08 125)',
		muted: 'oklch(0.64 0.04 130)',
		border: 'oklch(0.30 0.04 135)',
		subtle: 'oklch(0.20 0.03 135)',
		primary: 'oklch(0.72 0.18 135)',
		'primary-hover': 'oklch(0.78 0.16 135)',
		'primary-container': 'oklch(0.28 0.08 135)',
		'on-primary-container': 'oklch(0.92 0.04 130)',
		'primary-dim': 'oklch(0.32 0.10 135)',
		'on-primary': 'oklch(0.14 0.04 135)',
		secondary: 'oklch(0.18 0.03 125)',
		'on-secondary': 'oklch(0.82 0.06 125)',
		input: 'oklch(0.13 0.03 135)',
		'input-border': 'oklch(0.52 0.08 130)',
		'surface-1': 'oklch(0.14 0.03 135)',
		'surface-2': 'oklch(0.12 0.02 135)',
		'surface-3': 'oklch(0.08 0.01 135)',
	}),
};

/**
 * P5 — Deep Violet (high-chroma ~290° purple)
 */
const P5: Palette = {
	id: 'P5' as PaletteId,
	name: 'Deep Violet',
	description: 'Moody, rich purples.',
	light: defineColors({
		bg: 'oklch(0.94 0.06 290)',
		fg: 'oklch(0.22 0.08 295)',
		body: 'oklch(0.26 0.06 290)',
		heading: 'oklch(0.22 0.08 295)',
		muted: 'oklch(0.46 0.04 290)',
		border: 'oklch(0.82 0.05 290)',
		subtle: 'oklch(0.91 0.04 290)',
		primary: 'oklch(0.48 0.20 290)',
		'primary-hover': 'oklch(0.42 0.22 290)',
		'primary-container': 'oklch(0.88 0.07 290)',
		'on-primary-container': 'oklch(0.20 0.10 295)',
		'primary-dim': 'oklch(0.65 0.14 290)',
		'on-primary': 'oklch(0.96 0.02 290)',
		secondary: 'oklch(0.86 0.04 310)',
		'on-secondary': 'oklch(0.24 0.06 310)',
		input: 'oklch(0.93 0.04 290)',
		'input-border': 'oklch(0.46 0.10 290)',
		'surface-1': 'oklch(0.95 0.04 290)',
		'surface-2': 'oklch(0.96 0.03 290)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.15 0.04 290)',
		fg: 'oklch(0.86 0.06 285)',
		body: 'oklch(0.80 0.05 288)',
		heading: 'oklch(0.86 0.06 285)',
		muted: 'oklch(0.62 0.04 290)',
		border: 'oklch(0.30 0.04 290)',
		subtle: 'oklch(0.20 0.03 290)',
		primary: 'oklch(0.68 0.18 290)',
		'primary-hover': 'oklch(0.74 0.16 290)',
		'primary-container': 'oklch(0.26 0.10 290)',
		'on-primary-container': 'oklch(0.92 0.03 285)',
		'primary-dim': 'oklch(0.32 0.10 290)',
		'on-primary': 'oklch(0.12 0.04 290)',
		secondary: 'oklch(0.18 0.03 310)',
		'on-secondary': 'oklch(0.80 0.05 310)',
		input: 'oklch(0.12 0.03 290)',
		'input-border': 'oklch(0.50 0.08 290)',
		'surface-1': 'oklch(0.13 0.03 290)',
		'surface-2': 'oklch(0.11 0.02 290)',
		'surface-3': 'oklch(0.07 0.01 290)',
	}),
};

/**
 * P6 — Terracotta (high-chroma ~25° warm clay)
 */
const P6: Palette = {
	id: 'P6' as PaletteId,
	name: 'Terracotta',
	description: 'Warm clay, earthy tones.',
	light: defineColors({
		bg: 'oklch(0.93 0.07 25)',
		fg: 'oklch(0.22 0.06 20)',
		body: 'oklch(0.26 0.05 22)',
		heading: 'oklch(0.22 0.06 20)',
		muted: 'oklch(0.46 0.04 25)',
		border: 'oklch(0.82 0.06 25)',
		subtle: 'oklch(0.90 0.05 25)',
		primary: 'oklch(0.52 0.18 25)',
		'primary-hover': 'oklch(0.46 0.20 25)',
		'primary-container': 'oklch(0.88 0.07 25)',
		'on-primary-container': 'oklch(0.20 0.08 20)',
		'primary-dim': 'oklch(0.66 0.12 25)',
		'on-primary': 'oklch(0.96 0.02 25)',
		secondary: 'oklch(0.86 0.04 40)',
		'on-secondary': 'oklch(0.24 0.06 40)',
		input: 'oklch(0.92 0.05 25)',
		'input-border': 'oklch(0.48 0.10 25)',
		'surface-1': 'oklch(0.94 0.05 25)',
		'surface-2': 'oklch(0.96 0.03 25)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.16 0.04 25)',
		fg: 'oklch(0.86 0.06 30)',
		body: 'oklch(0.80 0.05 28)',
		heading: 'oklch(0.86 0.06 30)',
		muted: 'oklch(0.62 0.04 25)',
		border: 'oklch(0.30 0.04 25)',
		subtle: 'oklch(0.20 0.03 25)',
		primary: 'oklch(0.68 0.16 25)',
		'primary-hover': 'oklch(0.74 0.14 25)',
		'primary-container': 'oklch(0.28 0.08 25)',
		'on-primary-container': 'oklch(0.92 0.03 30)',
		'primary-dim': 'oklch(0.34 0.08 25)',
		'on-primary': 'oklch(0.14 0.04 25)',
		secondary: 'oklch(0.18 0.03 40)',
		'on-secondary': 'oklch(0.80 0.05 40)',
		input: 'oklch(0.13 0.03 25)',
		'input-border': 'oklch(0.52 0.08 25)',
		'surface-1': 'oklch(0.14 0.03 25)',
		'surface-2': 'oklch(0.12 0.02 25)',
		'surface-3': 'oklch(0.08 0.01 25)',
	}),
};

/**
 * P7 — Midnight (high-chroma ~260° cyberpunk, dark-biased)
 */
const P7: Palette = {
	id: 'P7' as PaletteId,
	name: 'Midnight',
	description: 'Cyberpunk neon accents on dark surfaces.',
	light: defineColors({
		bg: 'oklch(0.94 0.04 260)',
		fg: 'oklch(0.20 0.06 265)',
		body: 'oklch(0.24 0.05 262)',
		heading: 'oklch(0.20 0.06 265)',
		muted: 'oklch(0.46 0.03 260)',
		border: 'oklch(0.82 0.04 260)',
		subtle: 'oklch(0.91 0.03 260)',
		primary: 'oklch(0.52 0.22 265)',
		'primary-hover': 'oklch(0.46 0.24 265)',
		'primary-container': 'oklch(0.88 0.06 265)',
		'on-primary-container': 'oklch(0.18 0.10 265)',
		'primary-dim': 'oklch(0.65 0.15 265)',
		'on-primary': 'oklch(0.96 0.02 260)',
		secondary: 'oklch(0.86 0.03 280)',
		'on-secondary': 'oklch(0.22 0.06 280)',
		input: 'oklch(0.93 0.03 260)',
		'input-border': 'oklch(0.46 0.08 260)',
		'surface-1': 'oklch(0.95 0.03 260)',
		'surface-2': 'oklch(0.96 0.02 260)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.12 0.04 260)',
		fg: 'oklch(0.88 0.06 255)',
		body: 'oklch(0.82 0.05 258)',
		heading: 'oklch(0.88 0.06 255)',
		muted: 'oklch(0.64 0.04 260)',
		border: 'oklch(0.28 0.04 260)',
		subtle: 'oklch(0.18 0.03 260)',
		primary: 'oklch(0.72 0.22 265)',
		'primary-hover': 'oklch(0.78 0.20 265)',
		'primary-container': 'oklch(0.24 0.10 265)',
		'on-primary-container': 'oklch(0.92 0.04 255)',
		'primary-dim': 'oklch(0.30 0.12 265)',
		'on-primary': 'oklch(0.10 0.04 260)',
		secondary: 'oklch(0.16 0.03 280)',
		'on-secondary': 'oklch(0.82 0.05 280)',
		input: 'oklch(0.10 0.03 260)',
		'input-border': 'oklch(0.52 0.08 260)',
		'surface-1': 'oklch(0.10 0.03 260)',
		'surface-2': 'oklch(0.08 0.02 260)',
		'surface-3': 'oklch(0.05 0.01 260)',
	}),
};

export const PALETTE_REGISTRY: readonly Palette[] = [P0, P1, P2, P3, P4, P5, P6, P7] as const;

export const PALETTE_IDS: readonly [PaletteId, ...PaletteId[]] = [P0.id, P1.id, P2.id, P3.id, P4.id, P5.id, P6.id, P7.id];

export function getPalette(id: PaletteId): Palette | undefined {
	return PALETTE_REGISTRY.find((p) => p.id === id);
}

// Build-time WCAG validation — runs once at import
for (const palette of PALETTE_REGISTRY) {
	const lightFailures = validatePaletteContrast(palette.light);
	const darkFailures = validatePaletteContrast(palette.dark);

	if (lightFailures.length > 0) {
		console.warn(`[style] Palette ${palette.id} (${palette.name}) light mode contrast failures:`, lightFailures);
	}
	if (darkFailures.length > 0) {
		console.warn(`[style] Palette ${palette.id} (${palette.name}) dark mode contrast failures:`, darkFailures);
	}
}
