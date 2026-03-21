/**
 * Type definitions for the Style Randomizer system.
 * Branded types for palette/typography/radius IDs, palette color maps, and resolved style configs.
 */

/** Branded palette identifier (e.g. "P0", "P1") */
export type PaletteId = string & { readonly __brand: 'PaletteId' };

/** Branded typography identifier (e.g. "T1", "T2") */
export type TypographyId = string & { readonly __brand: 'TypographyId' };

/** Branded radius identifier (e.g. "R1", "R2") */
export type RadiusId = string & { readonly __brand: 'RadiusId' };

/** The 20 overridable color tokens per palette per mode */
export interface PaletteColors {
	bg: string;
	fg: string;
	body: string;
	heading: string;
	muted: string;
	border: string;
	subtle: string;
	primary: string;
	'primary-hover': string;
	'primary-container': string;
	'on-primary-container': string;
	'primary-dim': string;
	'on-primary': string;
	secondary: string;
	'on-secondary': string;
	input: string;
	'input-border': string;
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

/** A radius preset definition */
export interface RadiusSet {
	id: RadiusId;
	name: string;
	description: string;
	sm: string;
	md: string;
	lg: string;
	xl: string;
	full: string;
}

/** Raw style config stored in cookie */
export interface StyleConfig {
	paletteId: PaletteId;
	typographyId: TypographyId;
	radiusId: RadiusId;
}

/** Fully resolved style with display names */
export interface ResolvedStyle {
	paletteId: PaletteId;
	typographyId: TypographyId;
	radiusId: RadiusId;
	paletteName: string;
	typographyName: string;
	radiusName: string;
	/** True when this style came from corporate brand settings */
	corporate?: boolean;
}

/** Cookie wire format (compact keys for size) */
export interface StyleCookie {
	pid: string;
	tid: string;
	rid: string;
	v: 1;
}
