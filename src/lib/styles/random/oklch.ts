/**
 * Shared OKLCH parsing and formatting utilities.
 * Used by contrast validation, accent derivation, and color input components.
 */

import type { Oklch } from 'culori';

/** Parse an OKLCH string like "oklch(0.55 0.18 260)" into a culori Oklch object */
export function parseOklch(value: string): Oklch {
	const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
	if (!match) throw new Error(`Invalid OKLCH value: ${value}`);
	return {
		mode: 'oklch',
		l: Number(match[1]),
		c: Number(match[2]),
		h: Number(match[3]),
	};
}

/** Format an Oklch object back to an OKLCH string with consistent precision */
export function formatOklch(color: Oklch): string {
	const l = clamp(color.l, 0, 1);
	const c = clamp(color.c, 0, 0.4);
	const h = ((color.h ?? 0) % 360 + 360) % 360;
	return `oklch(${round(l)} ${round(c)} ${round(h)})`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function round(value: number): string {
	return (Math.round(value * 1000) / 1000).toString();
}
