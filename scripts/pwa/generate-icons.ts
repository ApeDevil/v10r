/**
 * Generate PWA icons from the brand vector into static/icons/.
 *
 * Run inside the container: bun run pwa:icons
 * Outputs are committed — this script runs once per logo change, not at build time.
 *
 * Sizes follow the installability minimum (192/512) plus maskable variants
 * (content confined to the 80% safe zone so Android's mask never clips it)
 * and the 180px apple-touch-icon (iOS ignores manifest icons).
 */
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE = 'static/logo/logo-hero.svg';
const OUT_DIR = 'static/icons';

/** Light page background token (--color-bg light), pre-resolved to sRGB.
 * Maskable + apple icons need an opaque background; transparent renders as
 * black on iOS and clips ugly under Android masks. */
const BG = { r: 207, g: 217, b: 225, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Rasterize the (non-square) SVG onto a square canvas.
 * `content` = fraction of the canvas the logo may occupy (1 = full bleed). */
async function renderIcon(size: number, content: number, background: sharp.Color) {
	const inner = Math.round(size * content);
	const logo = await sharp(SOURCE, { density: 300 })
		.resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
		.png()
		.toBuffer();
	const pad = size - inner;
	return sharp(logo)
		.extend({
			top: Math.floor(pad / 2),
			bottom: Math.ceil(pad / 2),
			left: Math.floor(pad / 2),
			right: Math.ceil(pad / 2),
			background,
		})
		.flatten(background === TRANSPARENT ? false : { background })
		.png()
		.toBuffer();
}

const targets: Array<{ file: string; size: number; content: number; background: sharp.Color }> = [
	{ file: 'icon-192.png', size: 192, content: 0.94, background: TRANSPARENT },
	{ file: 'icon-512.png', size: 512, content: 0.94, background: TRANSPARENT },
	// Maskable: keep content inside the 80% safe zone (40%-radius circle rule).
	{ file: 'maskable-192.png', size: 192, content: 0.8, background: BG },
	{ file: 'maskable-512.png', size: 512, content: 0.8, background: BG },
	{ file: 'apple-touch-icon-180.png', size: 180, content: 0.88, background: BG },
];

await mkdir(OUT_DIR, { recursive: true });
for (const t of targets) {
	const buf = await renderIcon(t.size, t.content, t.background);
	await Bun.write(`${OUT_DIR}/${t.file}`, buf);
	console.log(`✓ ${OUT_DIR}/${t.file} (${t.size}x${t.size}, ${(buf.byteLength / 1024).toFixed(1)} KB)`);
}
