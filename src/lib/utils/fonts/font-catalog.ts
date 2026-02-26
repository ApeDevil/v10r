import type { FontCategory, FontFamily, FontPairing } from './types';

/**
 * Curated font catalog. Each entry demonstrates a distinct typographic personality.
 * To add a font: add an entry here. No other files need to change.
 */
export const fontCatalog: FontFamily[] = [
	// === System (no loading needed) ===
	{
		family: 'System',
		category: 'sans-serif',
		weights: [400, 500, 600, 700],
		variable: false,
		fallback: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
		note: 'Default system font stack. No network request.',
	},

	// === Sans Serif ===
	{
		family: 'Inter',
		category: 'sans-serif',
		weights: [400, 500, 600, 700],
		variable: true,
		fallback: 'system-ui, sans-serif',
		note: 'Variable font designed for screens. Industry standard.',
	},
	{
		family: 'Geist',
		category: 'sans-serif',
		weights: [400, 500, 600, 700],
		variable: true,
		fallback: 'system-ui, sans-serif',
		note: "Vercel's typeface. Neutral, technical aesthetic.",
	},
	{
		family: 'Work Sans',
		category: 'sans-serif',
		weights: [400, 500, 600, 700],
		variable: true,
		fallback: 'system-ui, sans-serif',
		note: 'Optimized for on-screen body text. Friendly personality.',
	},

	// === Serif ===
	{
		family: 'Playfair Display',
		category: 'serif',
		weights: [400, 700],
		variable: true,
		fallback: "Georgia, 'Times New Roman', serif",
		note: 'High-contrast transitional serif. Editorial headings.',
	},
	{
		family: 'Merriweather',
		category: 'serif',
		weights: [400, 700],
		variable: false,
		fallback: 'Georgia, serif',
		note: 'Designed for screen body text. Wide counters, sturdy serifs.',
	},
	{
		family: 'Lora',
		category: 'serif',
		weights: [400, 500, 600, 700],
		variable: true,
		fallback: 'Georgia, serif',
		note: 'Calligraphic serif. Well-suited for body text and headings.',
	},

	// === Monospace ===
	{
		family: 'JetBrains Mono',
		category: 'monospace',
		weights: [400, 700],
		variable: true,
		fallback: "'Fira Code', 'Courier New', monospace",
		note: 'Designed for code. Increased height for readability.',
	},
	{
		family: 'Fira Code',
		category: 'monospace',
		weights: [400, 700],
		variable: true,
		fallback: "'Courier New', monospace",
		note: 'Programming ligatures. Popular with developers.',
	},

	// === Display ===
	{
		family: 'Space Grotesk',
		category: 'display',
		weights: [400, 500, 700],
		variable: true,
		fallback: 'system-ui, sans-serif',
		note: 'Geometric sans with personality. Tech branding.',
	},
	{
		family: 'Syne',
		category: 'display',
		weights: [400, 500, 600, 700],
		variable: true,
		fallback: 'system-ui, sans-serif',
		note: 'Bold, expressive display face. Creative projects.',
	},
];

export function getFontsByCategory(category: FontCategory): FontFamily[] {
	return fontCatalog.filter((f) => f.category === category);
}

export function findFont(family: string): FontFamily | undefined {
	return fontCatalog.find((f) => f.family === family);
}

export const categories: { key: FontCategory; label: string }[] = [
	{ key: 'sans-serif', label: 'Sans' },
	{ key: 'serif', label: 'Serif' },
	{ key: 'monospace', label: 'Mono' },
	{ key: 'display', label: 'Display' },
];

export const fontPairings: FontPairing[] = [
	{
		name: 'Editorial Classic',
		heading: 'Playfair Display',
		body: 'Lora',
		description: 'High-contrast serif headlines with calligraphic body text. Traditional editorial feel.',
	},
	{
		name: 'Tech Startup',
		heading: 'Space Grotesk',
		body: 'Inter',
		description: 'Geometric display headings with neutral body text. Clean, modern tech aesthetic.',
	},
	{
		name: 'Bold Creative',
		heading: 'Syne',
		body: 'Work Sans',
		description: 'Expressive display headings with friendly body text. Energetic and approachable.',
	},
	{
		name: 'Clean Technical',
		heading: 'Geist',
		body: 'Inter',
		description: 'Two neutral sans-serifs tuned for different roles. Minimal, developer-friendly.',
	},
	{
		name: 'Warm Editorial',
		heading: 'Merriweather',
		body: 'Work Sans',
		description: 'Sturdy serif headings with humanist sans body. Warm, readable long-form.',
	},
];

export function findPairing(name: string): FontPairing | undefined {
	return fontPairings.find((p) => p.name === name);
}
