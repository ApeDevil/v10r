/**
 * Parity gate: the committed wasm artifact and the JS twins in filters.ts must
 * produce byte-identical output — compared directly, byte for byte; the page's
 * FNV-1a checksum is only the concise UI indicator, not the proof. This catches
 * a JS-side edit that drifts from the artifact; a Rust-side edit without a
 * rebuild is caught by kernel-manifest.test.ts instead (this file would keep
 * passing against the stale binary). It doubles as proof that the vendored
 * artifact loads under plain Node (the same explicit-bytes path Vercel
 * functions would need): fetch cannot load file: URLs, so the module is
 * compiled from bytes read off disk.
 */
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { boxBlur, grayscale, makeFloatData, makeTestImage, scaleInPlace } from './filters';
import init, { FloatKernel, PixelKernel, scale_copied } from './kernel/kernel.js';

let memory: WebAssembly.Memory;

beforeAll(async () => {
	const bytes = await readFile(new URL('./kernel/kernel_bg.wasm', import.meta.url));
	const module = await WebAssembly.compile(bytes);
	memory = (await init({ module_or_path: module })).memory;
});

/** Index of the first differing byte, or -1 — failure output names the position. */
function firstDiff(a: ArrayBufferView, b: ArrayBufferView): number {
	const av = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
	const bv = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
	if (av.length !== bv.length) return Math.min(av.length, bv.length);
	for (let i = 0; i < av.length; i++) {
		if (av[i] !== bv[i]) return i;
	}
	return -1;
}

function runWasmFilter(width: number, height: number, run: (k: PixelKernel) => void): Uint8ClampedArray {
	const kernel = new PixelKernel(width, height);
	try {
		const src = makeTestImage(width, height);
		// Views are taken fresh around every kernel call: the constructor may grow
		// memory, and box_blur swaps the internal buffers so pixels_ptr() moves.
		new Uint8Array(memory.buffer, kernel.pixels_ptr(), kernel.byte_len()).set(src);
		run(kernel);
		return new Uint8ClampedArray(new Uint8Array(memory.buffer, kernel.pixels_ptr(), kernel.byte_len()));
	} finally {
		kernel.free();
	}
}

describe('wasm ↔ JS parity', () => {
	const width = 96;
	const height = 64;

	it('grayscale matches byte-for-byte', () => {
		const js = makeTestImage(width, height);
		grayscale(js);
		const wasm = runWasmFilter(width, height, (k) => k.grayscale());
		expect(firstDiff(wasm, js)).toBe(-1);
	});

	it.each([1, 3, 7])('box blur radius %i matches byte-for-byte', (radius) => {
		const src = makeTestImage(width, height);
		const js = new Uint8ClampedArray(src.length);
		boxBlur(src, js, width, height, radius);
		const wasm = runWasmFilter(width, height, (k) => k.box_blur(radius));
		expect(firstDiff(wasm, js)).toBe(-1);
	});

	it('scale parity holds across all three lanes for repeated rounds', () => {
		const rounds = 5;
		const factor = 1.5;
		const len = 4096;

		const js = makeFloatData(len);
		for (let i = 0; i < rounds; i++) scaleInPlace(js, factor);

		let copied = makeFloatData(len);
		for (let i = 0; i < rounds; i++) copied = scale_copied(copied, factor);

		const resident = new FloatKernel(len);
		let residentOut: Float32Array;
		try {
			new Float32Array(memory.buffer, resident.ptr(), resident.len()).set(makeFloatData(len));
			for (let i = 0; i < rounds; i++) resident.scale(factor);
			residentOut = new Float32Array(memory.buffer, resident.ptr(), resident.len()).slice();
		} finally {
			resident.free();
		}

		expect(firstDiff(copied, js)).toBe(-1);
		expect(firstDiff(residentOut, js)).toBe(-1);
	});
});
