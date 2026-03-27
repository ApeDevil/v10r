/**
 * Analogous accent color derivation.
 * Derives 5 accent tokens from a primary OKLCH color + hue offset.
 * Isomorphic — runs server-side (SSR injection) and client-side (editor preview).
 */

import { parseOklch, formatOklch } from './oklch';
import { contrastRatio } from './contrast';

/** The 5 accent token keys */
export const ACCENT_TOKEN_KEYS = [
	'accent',
	'accent-hover',
	'on-accent',
	'accent-container',
	'on-accent-container',
] as const;

export type AccentTokenKey = (typeof ACCENT_TOKEN_KEYS)[number];

export interface AccentTokens {
	accent: string;
	'accent-hover': string;
	'on-accent': string;
	'accent-container': string;
	'on-accent-container': string;
}

/**
 * Derive 5 accent color tokens from a primary color and hue offset.
 *
 * @param primaryOklch - Primary color as oklch() string (e.g., "oklch(0.50 0.14 230)")
 * @param offset - Hue offset in degrees (-60 to +60). 0 = monochrome (accent equals primary).
 * @returns Record of 5 accent tokens as oklch() strings
 */
export function deriveAccentTokens(primaryOklch: string, offset: number): AccentTokens {
	const primary = parseOklch(primaryOklch);
	const primaryH = primary.h ?? 0;
	const primaryC = primary.c;
	const primaryL = primary.l;

	// Core accent: shift hue, reduce chroma to 65% of primary
	const accentH = primaryH + offset;
	const accentC = primaryC * 0.65;
	const accentL = primaryL;

	const accent = formatOklch({ mode: 'oklch', l: accentL, c: accentC, h: accentH });

	// Hover: slightly darker
	const accentHover = formatOklch({
		mode: 'oklch',
		l: accentL - 0.06,
		c: accentC,
		h: accentH,
	});

	// On-accent: high contrast text on accent surface
	const onAccent = pickContrastText(accentL, accentC, accentH);

	// Container: lighter, lower chroma version for backgrounds
	const containerL = Math.min(accentL + 0.35, 0.95);
	const containerC = accentC * 0.45;
	const accentContainer = formatOklch({
		mode: 'oklch',
		l: containerL,
		c: containerC,
		h: accentH,
	});

	// On-accent-container: high contrast text on container
	const onAccentContainer = pickContrastText(containerL, containerC, accentH);

	return {
		accent,
		'accent-hover': accentHover,
		'on-accent': onAccent,
		'accent-container': accentContainer,
		'on-accent-container': onAccentContainer,
	};
}

/**
 * Pick a high-contrast text color for a given background.
 * Tests dark and light candidates against the background and returns
 * the one with better contrast ratio (WCAG 2.x).
 */
function pickContrastText(bgL: number, bgC: number, bgH: number): string {
	const bg = formatOklch({ mode: 'oklch', l: bgL, c: bgC, h: bgH });

	// Candidates: dark text with slight hue tint, light text with slight hue tint
	const dark = formatOklch({ mode: 'oklch', l: 0.20, c: Math.min(bgC * 0.3, 0.03), h: bgH });
	const light = formatOklch({ mode: 'oklch', l: 0.95, c: Math.min(bgC * 0.15, 0.015), h: bgH });

	const darkRatio = contrastRatio(dark, bg);
	const lightRatio = contrastRatio(light, bg);

	return darkRatio >= lightRatio ? dark : light;
}
