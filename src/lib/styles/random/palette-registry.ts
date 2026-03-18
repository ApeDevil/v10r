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
		muted: 'oklch(0.35 0 0)',
		border: 'oklch(0.20 0 0)',
		subtle: 'oklch(0.93 0 0)',
		primary: 'oklch(0.40 0.15 265)',
		'primary-hover': 'oklch(0.35 0.17 265)',
		'primary-bg': 'oklch(0.92 0.03 265)',
		'primary-fg': 'oklch(0.15 0.05 265)',
		'primary-light': 'oklch(0.70 0.10 265)',
		'on-primary': 'oklch(0.97 0 0)',
		'secondary-bg': 'oklch(0.90 0 0)',
		'secondary-fg': 'oklch(0.15 0 0)',
		'input-border': 'oklch(0.30 0 0)',
		'input-bg': 'oklch(0.98 0 0)',
		'bg-alpha': 'oklch(0.97 0 0 / 0.95)',
		'fg-alpha': 'oklch(0.13 0 0 / 0.1)',
		'surface-0': 'oklch(0.97 0 0)',
		'surface-1': 'oklch(0.98 0 0)',
		'surface-2': 'oklch(0.99 0 0)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.10 0 0)',
		fg: 'oklch(0.95 0 0)',
		body: 'oklch(0.95 0 0)',
		muted: 'oklch(0.72 0 0)',
		border: 'oklch(0.85 0 0)',
		subtle: 'oklch(0.15 0 0)',
		primary: 'oklch(0.72 0.14 265)',
		'primary-hover': 'oklch(0.78 0.12 265)',
		'primary-bg': 'oklch(0.25 0.08 265)',
		'primary-fg': 'oklch(0.95 0.02 265)',
		'primary-light': 'oklch(0.35 0.10 265)',
		'on-primary': 'oklch(0.10 0 0)',
		'secondary-bg': 'oklch(0.15 0 0)',
		'secondary-fg': 'oklch(0.92 0 0)',
		'input-border': 'oklch(0.75 0 0)',
		'input-bg': 'oklch(0.08 0 0)',
		'bg-alpha': 'oklch(0.10 0 0 / 0.95)',
		'fg-alpha': 'oklch(0.95 0 0 / 0.1)',
		'surface-0': 'oklch(0.10 0 0)',
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
		bg: 'oklch(0.95 0.01 220)',
		fg: 'oklch(0.25 0.06 230)',
		body: 'oklch(0.28 0.05 225)',
		muted: 'oklch(0.50 0.03 220)',
		border: 'oklch(0.85 0.02 220)',
		subtle: 'oklch(0.93 0.01 220)',
		primary: 'oklch(0.50 0.14 230)',
		'primary-hover': 'oklch(0.44 0.16 230)',
		'primary-bg': 'oklch(0.90 0.04 230)',
		'primary-fg': 'oklch(0.22 0.08 230)',
		'primary-light': 'oklch(0.65 0.10 230)',
		'on-primary': 'oklch(0.97 0.01 220)',
		'secondary-bg': 'oklch(0.88 0.02 200)',
		'secondary-fg': 'oklch(0.25 0.06 200)',
		'input-border': 'oklch(0.50 0.08 200)',
		'input-bg': 'oklch(0.94 0.01 220)',
		'bg-alpha': 'oklch(0.95 0.01 220 / 0.95)',
		'fg-alpha': 'oklch(0.25 0.06 230 / 0.1)',
		'surface-0': 'oklch(0.95 0.01 220)',
		'surface-1': 'oklch(0.96 0.01 220)',
		'surface-2': 'oklch(0.97 0.005 220)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.16 0.02 225)',
		fg: 'oklch(0.82 0.06 200)',
		body: 'oklch(0.78 0.05 210)',
		muted: 'oklch(0.62 0.03 220)',
		border: 'oklch(0.30 0.03 225)',
		subtle: 'oklch(0.20 0.02 225)',
		primary: 'oklch(0.65 0.12 225)',
		'primary-hover': 'oklch(0.72 0.10 225)',
		'primary-bg': 'oklch(0.28 0.08 230)',
		'primary-fg': 'oklch(0.90 0.03 220)',
		'primary-light': 'oklch(0.32 0.08 230)',
		'on-primary': 'oklch(0.12 0.02 225)',
		'secondary-bg': 'oklch(0.18 0.02 210)',
		'secondary-fg': 'oklch(0.78 0.06 210)',
		'input-border': 'oklch(0.50 0.06 210)',
		'input-bg': 'oklch(0.12 0.02 225)',
		'bg-alpha': 'oklch(0.16 0.02 225 / 0.95)',
		'fg-alpha': 'oklch(0.82 0.06 200 / 0.1)',
		'surface-0': 'oklch(0.16 0.02 225)',
		'surface-1': 'oklch(0.14 0.02 225)',
		'surface-2': 'oklch(0.12 0.015 225)',
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
		bg: 'oklch(0.96 0.01 60)',
		fg: 'oklch(0.25 0.06 30)',
		body: 'oklch(0.28 0.05 35)',
		muted: 'oklch(0.50 0.03 50)',
		border: 'oklch(0.85 0.03 55)',
		subtle: 'oklch(0.93 0.02 55)',
		primary: 'oklch(0.55 0.16 40)',
		'primary-hover': 'oklch(0.48 0.18 40)',
		'primary-bg': 'oklch(0.92 0.04 45)',
		'primary-fg': 'oklch(0.25 0.08 35)',
		'primary-light': 'oklch(0.70 0.10 45)',
		'on-primary': 'oklch(0.98 0.01 50)',
		'secondary-bg': 'oklch(0.90 0.02 70)',
		'secondary-fg': 'oklch(0.28 0.05 70)',
		'input-border': 'oklch(0.52 0.08 45)',
		'input-bg': 'oklch(0.95 0.01 55)',
		'bg-alpha': 'oklch(0.96 0.01 60 / 0.95)',
		'fg-alpha': 'oklch(0.25 0.06 30 / 0.1)',
		'surface-0': 'oklch(0.96 0.01 60)',
		'surface-1': 'oklch(0.97 0.01 55)',
		'surface-2': 'oklch(0.98 0.005 55)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.15 0.02 40)',
		fg: 'oklch(0.85 0.05 50)',
		body: 'oklch(0.80 0.04 45)',
		muted: 'oklch(0.62 0.03 50)',
		border: 'oklch(0.30 0.03 45)',
		subtle: 'oklch(0.20 0.02 45)',
		primary: 'oklch(0.68 0.14 40)',
		'primary-hover': 'oklch(0.74 0.12 40)',
		'primary-bg': 'oklch(0.28 0.08 40)',
		'primary-fg': 'oklch(0.92 0.03 50)',
		'primary-light': 'oklch(0.32 0.08 45)',
		'on-primary': 'oklch(0.12 0.02 40)',
		'secondary-bg': 'oklch(0.18 0.02 60)',
		'secondary-fg': 'oklch(0.80 0.05 60)',
		'input-border': 'oklch(0.52 0.06 45)',
		'input-bg': 'oklch(0.12 0.02 40)',
		'bg-alpha': 'oklch(0.15 0.02 40 / 0.95)',
		'fg-alpha': 'oklch(0.85 0.05 50 / 0.1)',
		'surface-0': 'oklch(0.15 0.02 40)',
		'surface-1': 'oklch(0.13 0.02 40)',
		'surface-2': 'oklch(0.11 0.015 40)',
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
		bg: 'oklch(0.95 0.01 145)',
		fg: 'oklch(0.22 0.06 155)',
		body: 'oklch(0.26 0.05 150)',
		muted: 'oklch(0.48 0.03 145)',
		border: 'oklch(0.84 0.03 145)',
		subtle: 'oklch(0.92 0.02 145)',
		primary: 'oklch(0.48 0.12 155)',
		'primary-hover': 'oklch(0.42 0.14 155)',
		'primary-bg': 'oklch(0.90 0.04 150)',
		'primary-fg': 'oklch(0.20 0.07 155)',
		'primary-light': 'oklch(0.62 0.08 150)',
		'on-primary': 'oklch(0.97 0.01 145)',
		'secondary-bg': 'oklch(0.89 0.02 130)',
		'secondary-fg': 'oklch(0.25 0.05 130)',
		'input-border': 'oklch(0.48 0.07 150)',
		'input-bg': 'oklch(0.94 0.01 145)',
		'bg-alpha': 'oklch(0.95 0.01 145 / 0.95)',
		'fg-alpha': 'oklch(0.22 0.06 155 / 0.1)',
		'surface-0': 'oklch(0.95 0.01 145)',
		'surface-1': 'oklch(0.96 0.01 145)',
		'surface-2': 'oklch(0.97 0.005 145)',
		'surface-3': 'oklch(1.0 0 0)',
	}),
	dark: defineColors({
		bg: 'oklch(0.15 0.02 150)',
		fg: 'oklch(0.82 0.05 140)',
		body: 'oklch(0.78 0.04 145)',
		muted: 'oklch(0.60 0.03 145)',
		border: 'oklch(0.28 0.03 150)',
		subtle: 'oklch(0.19 0.02 150)',
		primary: 'oklch(0.62 0.10 150)',
		'primary-hover': 'oklch(0.68 0.08 150)',
		'primary-bg': 'oklch(0.26 0.06 155)',
		'primary-fg': 'oklch(0.90 0.03 145)',
		'primary-light': 'oklch(0.30 0.06 150)',
		'on-primary': 'oklch(0.12 0.02 150)',
		'secondary-bg': 'oklch(0.17 0.02 135)',
		'secondary-fg': 'oklch(0.78 0.05 135)',
		'input-border': 'oklch(0.48 0.05 145)',
		'input-bg': 'oklch(0.12 0.02 150)',
		'bg-alpha': 'oklch(0.15 0.02 150 / 0.95)',
		'fg-alpha': 'oklch(0.82 0.05 140 / 0.1)',
		'surface-0': 'oklch(0.15 0.02 150)',
		'surface-1': 'oklch(0.13 0.02 150)',
		'surface-2': 'oklch(0.11 0.015 150)',
		'surface-3': 'oklch(0.07 0.01 150)',
	}),
};

export const PALETTE_REGISTRY: readonly Palette[] = [P0, P1, P2, P3] as const;

export const PALETTE_IDS: readonly [PaletteId, ...PaletteId[]] = [P0.id, P1.id, P2.id, P3.id];

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
