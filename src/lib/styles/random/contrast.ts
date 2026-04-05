/**
 * WCAG 2.x contrast validation using culori for OKLCH→sRGB conversion.
 * Uses the corrected linearization threshold (0.04045 per CSS Color Level 4).
 */

import { converter } from 'culori';
import { parseOklch } from './oklch';
import type { PaletteColors } from './types';

const toRgb = converter('rgb');

/** Convert a single sRGB channel to linear (CSS Color Level 4 threshold: 0.04045) */
function linearize(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance from an OKLCH string */
export function luminance(oklchValue: string): number {
	const rgb = toRgb(parseOklch(oklchValue));
	if (!rgb) throw new Error(`Could not convert to RGB: ${oklchValue}`);
	const r = linearize(Math.max(0, Math.min(1, rgb.r)));
	const g = linearize(Math.max(0, Math.min(1, rgb.g)));
	const b = linearize(Math.max(0, Math.min(1, rgb.b)));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two OKLCH color strings */
export function contrastRatio(color1: string, color2: string): number {
	const l1 = luminance(color1);
	const l2 = luminance(color2);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

/** Critical text/background pairs to validate */
const CRITICAL_PAIRS: Array<{ fg: keyof PaletteColors; bg: keyof PaletteColors; minRatio: number }> = [
	{ fg: 'fg', bg: 'bg', minRatio: 4.5 },
	{ fg: 'body', bg: 'bg', minRatio: 4.5 },
	{ fg: 'heading', bg: 'bg', minRatio: 4.5 },
	{ fg: 'muted', bg: 'bg', minRatio: 3 },
	{ fg: 'on-primary-container', bg: 'primary-container', minRatio: 4.5 },
	{ fg: 'on-secondary', bg: 'secondary', minRatio: 4.5 },
	{ fg: 'on-primary', bg: 'primary', minRatio: 4.5 },
	{ fg: 'on-accent', bg: 'accent', minRatio: 4.5 },
	{ fg: 'on-accent-container', bg: 'accent-container', minRatio: 4.5 },
];

/** Validate all critical contrast pairs for a palette color set. Returns failures. */
export function validatePaletteContrast(
	colors: PaletteColors,
): Array<{ fg: string; bg: string; ratio: number; required: number }> {
	const failures: Array<{ fg: string; bg: string; ratio: number; required: number }> = [];

	for (const { fg, bg, minRatio } of CRITICAL_PAIRS) {
		try {
			const fgVal = colors[fg];
			const bgVal = colors[bg];
			if (!fgVal || !bgVal) continue;
			const ratio = contrastRatio(fgVal, bgVal);
			if (ratio < minRatio) {
				failures.push({ fg, bg, ratio: Math.round(ratio * 100) / 100, required: minRatio });
			}
		} catch {
			// Skip pairs with non-OKLCH values (e.g. rgb alpha values)
		}
	}

	return failures;
}
