export type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'display';

export interface FontFamily {
	/** Exact name Google Fonts expects (e.g., "Inter", "Playfair Display") */
	family: string;
	/** Classification for filtering */
	category: FontCategory;
	/** Available weights to load */
	weights: number[];
	/** Whether this is a variable font */
	variable: boolean;
	/** CSS fallback stack */
	fallback: string;
	/** Short description — why this font is in the catalog */
	note: string;
}

export type FontLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface FontPairing {
	name: string;
	heading: string;
	body: string;
	description: string;
}
