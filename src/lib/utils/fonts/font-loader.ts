/**
 * Dynamic font loader via Google Fonts CSS API v2.
 * Injects <link> elements into <head> on demand.
 */

const loadedFonts = new Set<string>();
const LINK_PREFIX = 'gf-';

/** Load a Google Font by injecting a stylesheet link. */
export async function loadFont(family: string, weights: number[] = [400, 700]): Promise<void> {
	if (family === 'System') return;

	const key = `${family}:${weights.join(',')}`;
	if (loadedFonts.has(key)) return;

	const weightSpec = weights.sort((a, b) => a - b).join(';');
	const encodedFamily = encodeURIComponent(`${family}:wght@${weightSpec}`);
	const url = `https://fonts.googleapis.com/css2?family=${encodedFamily}&display=swap`;

	const link = document.createElement('link');
	link.id = `${LINK_PREFIX}${family.replace(/\s+/g, '-').toLowerCase()}`;
	link.rel = 'stylesheet';
	link.href = url;

	await new Promise<void>((resolve, reject) => {
		link.onload = () => resolve();
		link.onerror = () => reject(new Error(`Failed to load font: ${family}`));
		document.head.appendChild(link);
	});

	// Wait for the browser to finish loading the font files referenced by the stylesheet
	await document.fonts.ready;

	loadedFonts.add(key);
}

/** Check if a font family has been loaded in this session. */
export function isFontLoaded(family: string): boolean {
	if (family === 'System') return true;
	for (const key of loadedFonts) {
		if (key.startsWith(`${family}:`)) return true;
	}
	return false;
}
