/**
 * Dominant-colour extraction — pure arithmetic over a pixel buffer.
 *
 * No DOM, no canvas, no `self` — so this runs identically on the main thread, in a
 * Web Worker, and in a node test. The browser-only half (decode, downscale) lives
 * in image-analysis.ts; the worker shell is image-analysis.worker.ts. Same
 * pure-core/impure-shell split as $lib/pwa/sw-policy.ts.
 *
 * This is the expensive part: a full pass over every pixel, which is exactly the
 * kind of work that has no business on the main thread.
 */

export interface Swatch {
	/** `#rrggbb`, the bucket's average colour. */
	hex: string;
	r: number;
	g: number;
	b: number;
	/** Share of counted pixels in this bucket, 0..1. */
	share: number;
}

/** Bits dropped per channel when bucketing. 3 → 32 levels/channel, 32768 buckets. */
const QUANT_BITS = 3;
const LEVELS = 1 << (8 - QUANT_BITS);

/** Below this alpha a pixel is treated as absent rather than as a dark colour. */
const ALPHA_FLOOR = 128;

function toHex(r: number, g: number, b: number): string {
	return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Bucket every pixel by quantised RGB and return the `count` heaviest buckets,
 * each averaged back to its true colour.
 *
 * Quantising rather than k-means on purpose: one deterministic pass, no iteration
 * count to tune, and no random seeding — which matters because the demo must
 * produce byte-identical output on the main thread and in the worker.
 */
export function dominantColors(pixels: Uint8ClampedArray, count = 5): Swatch[] {
	if (pixels.length < 4) return [];

	const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
	let counted = 0;

	for (let i = 0; i + 3 < pixels.length; i += 4) {
		const a = pixels[i + 3];
		if (a < ALPHA_FLOOR) continue;

		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];

		const key = ((r >> QUANT_BITS) * LEVELS + (g >> QUANT_BITS)) * LEVELS + (b >> QUANT_BITS);
		const bucket = buckets.get(key);
		if (bucket) {
			bucket.n++;
			bucket.r += r;
			bucket.g += g;
			bucket.b += b;
		} else {
			buckets.set(key, { n: 1, r, g, b });
		}
		counted++;
	}

	if (counted === 0) return [];

	return (
		[...buckets.values()]
			// Tie-break on colour so equal-weight buckets keep a stable order across runs.
			.sort((x, y) => y.n - x.n || x.r + x.g + x.b - (y.r + y.g + y.b))
			.slice(0, count)
			.map((bucket) => {
				const r = Math.round(bucket.r / bucket.n);
				const g = Math.round(bucket.g / bucket.n);
				const b = Math.round(bucket.b / bucket.n);
				return { hex: toHex(r, g, b), r, g, b, share: bucket.n / counted };
			})
	);
}

/** Mean luminance (0..1, Rec. 709) over the same alpha-filtered pixels. */
export function averageLuminance(pixels: Uint8ClampedArray): number {
	let sum = 0;
	let counted = 0;

	for (let i = 0; i + 3 < pixels.length; i += 4) {
		if (pixels[i + 3] < ALPHA_FLOOR) continue;
		sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
		counted++;
	}

	return counted === 0 ? 0 : sum / counted / 255;
}
