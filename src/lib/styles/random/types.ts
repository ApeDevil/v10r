/**
 * Type definitions for the Style Randomizer system.
 * Branded types for palette/typography IDs, palette color maps, and resolved style configs.
 */

/** Branded palette identifier (e.g. "P0", "P1") */
export type PaletteId = string & { readonly __brand: 'PaletteId' };

/** Branded typography identifier (e.g. "T1", "T2") */
export type TypographyId = string & { readonly __brand: 'TypographyId' };

/** The 22 overridable color tokens per palette per mode */
export interface PaletteColors {
	bg: string;
	fg: string;
	body: string;
	muted: string;
	border: string;
	subtle: string;
	primary: string;
	'primary-hover': string;
	'primary-bg': string;
	'primary-fg': string;
	'primary-light': string;
	'on-primary': string;
	'secondary-bg': string;
	'secondary-fg': string;
	'input-border': string;
	'input-bg': string;
	'bg-alpha': string;
	'fg-alpha': string;
	'surface-0': string;
	'surface-1': string;
	'surface-2': string;
	'surface-3': string;
}

/** A complete palette definition with light + dark mode colors */
export interface Palette {
	id: PaletteId;
	name: string;
	description: string;
	highContrast?: boolean;
	light: PaletteColors;
	dark: PaletteColors;
}

/** A typography set definition */
export interface TypographySet {
	id: TypographyId;
	name: string;
	description: string;
	heading: string;
	body: string;
	mono: string;
}

/** Raw style config stored in cookie */
export interface StyleConfig {
	paletteId: PaletteId;
	typographyId: TypographyId;
	locked: boolean;
}

/** Fully resolved style with display names */
export interface ResolvedStyle {
	paletteId: PaletteId;
	typographyId: TypographyId;
	paletteName: string;
	typographyName: string;
	locked: boolean;
}

/** Cookie wire format (compact keys for size) */
export interface StyleCookie {
	pid: string;
	tid: string;
	lck: boolean;
	v: 1;
}
