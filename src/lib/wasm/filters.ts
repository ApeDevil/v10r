/**
 * Pure-JS twins of the Rust kernel (crates/kernel/src/lib.rs).
 *
 * Line-for-line the same algorithms, integer math only: the showcase's honesty
 * hinges on both engines producing byte-identical output from identical work.
 * checksum() proves it at runtime on the page; kernel-parity.test.ts gates it
 * byte-for-byte in vitest against the committed wasm artifact. Change an
 * algorithm here and the parity test goes red; change the Rust side and
 * kernel-manifest.test.ts goes red until the artifact is rebuilt — parity alone
 * would keep passing against the stale committed binary.
 *
 * Everything in this file is pure and node-testable — no browser APIs.
 */

/** Rec.601 luma, scaled to /256 — matches `PixelKernel::grayscale` exactly. */
export function grayscale(pixels: Uint8ClampedArray): void {
	for (let i = 0; i < pixels.length; i += 4) {
		const y = (pixels[i] * 77 + pixels[i + 1] * 151 + pixels[i + 2] * 28) >> 8;
		pixels[i] = y;
		pixels[i + 1] = y;
		pixels[i + 2] = y;
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Direct 2D box blur, (2r+1)² taps per pixel — matches `PixelKernel::box_blur`.
 *
 * Deliberately the dense direct form, not the separable/sliding-window trick: the
 * benchmark's independent variable is the language, not the algorithm. `| 0`
 * truncates BEFORE the Uint8ClampedArray write — a plain assignment would round
 * to nearest and silently diverge from Rust's truncating integer division.
 */
export function boxBlur(
	src: Uint8ClampedArray,
	dst: Uint8ClampedArray,
	width: number,
	height: number,
	radius: number,
): void {
	const taps = (2 * radius + 1) * (2 * radius + 1);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let a0 = 0;
			let a1 = 0;
			let a2 = 0;
			let a3 = 0;
			for (let dy = -radius; dy <= radius; dy++) {
				const sy = clamp(y + dy, 0, height - 1);
				const row = sy * width * 4;
				for (let dx = -radius; dx <= radius; dx++) {
					const sx = clamp(x + dx, 0, width - 1);
					const i = row + sx * 4;
					a0 += src[i];
					a1 += src[i + 1];
					a2 += src[i + 2];
					a3 += src[i + 3];
				}
			}
			const o = (y * width + x) * 4;
			dst[o] = (a0 / taps) | 0;
			dst[o + 1] = (a1 / taps) | 0;
			dst[o + 2] = (a2 / taps) | 0;
			dst[o + 3] = (a3 / taps) | 0;
		}
	}
}

/**
 * Matches `FloatKernel::scale` / `scale_copied` bit-for-bit despite JS computing
 * in f64: the f32 input times an exactly-representable factor fits f64 exactly,
 * and the store back into the Float32Array performs the same round-to-nearest-f32
 * as Rust's IEEE f32 multiply. No Math.fround needed — and adding one would
 * burden the JS lane with work the comparison doesn't require.
 */
export function scaleInPlace(data: Float32Array, factor: number): void {
	for (let i = 0; i < data.length; i++) {
		data[i] *= factor;
	}
}

/** FNV-1a 32-bit over raw bytes — cheap, stable, and identical for identical frames. */
export function checksum(bytes: Uint8Array | Uint8ClampedArray): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < bytes.length; i++) {
		h ^= bytes[i];
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Deterministic synthetic test frame: two gradients plus an XOR texture. No
 * decode step, no asset, no PRNG — every visitor benchmarks the exact same
 * bytes, and the XOR plane's hard edges make the blur visually unmistakable.
 */
export function makeTestImage(width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
	const pixels = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const o = (y * width + x) * 4;
			pixels[o] = ((x * 255) / (width - 1)) | 0;
			pixels[o + 1] = ((y * 255) / (height - 1)) | 0;
			pixels[o + 2] = (x ^ y) & 255;
			pixels[o + 3] = 255;
		}
	}
	return pixels;
}

/** Base data for the boundary demo: small integers, exact in f32 at every scale step. */
export function makeFloatData(len: number): Float32Array {
	const data = new Float32Array(len);
	for (let i = 0; i < len; i++) {
		data[i] = i % 1024;
	}
	return data;
}
