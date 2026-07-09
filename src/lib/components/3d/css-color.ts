/**
 * Resolve a CSS custom property to a color string three.js can parse.
 *
 * Design tokens are authored in `oklch()` (app.css), which `THREE.Color` cannot
 * parse — and Chrome serializes `fillStyle` back in the authored color space, so
 * a fillStyle round-trip does NOT normalize. Painting one pixel and reading it
 * back does: `getImageData` on a default (srgb) canvas always yields sRGB bytes.
 */

let ctx: CanvasRenderingContext2D | null | undefined;

function pixelCtx(): CanvasRenderingContext2D | null {
	if (ctx !== undefined) return ctx;
	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;
	ctx = canvas.getContext('2d', { willReadFrequently: true });
	return ctx;
}

/** Read `--{token}` from the document root, normalized to sRGB hex. Falls back on SSR or unresolvable values. */
export function resolveCssColor(token: string, fallback: string): string {
	if (typeof document === 'undefined') return fallback;
	const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
	if (!raw) return fallback;
	const c = pixelCtx();
	if (!c) return fallback;
	// Invalid assignments leave fillStyle untouched — seed with the fallback so
	// an unparseable token value degrades to the fallback, not a stale color.
	c.fillStyle = fallback;
	c.fillStyle = raw;
	c.fillRect(0, 0, 1, 1);
	const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
	return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
