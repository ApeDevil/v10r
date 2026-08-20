import { describe, expect, it } from 'vitest';
import { median, stageStats, summarize } from './bench';
import { boxBlur, checksum, grayscale, makeFloatData, makeTestImage, scaleInPlace } from './filters';

describe('grayscale', () => {
	it('collapses RGB to the integer Rec.601 luma and preserves alpha', () => {
		const px = new Uint8ClampedArray([200, 100, 50, 123]);
		grayscale(px);
		const y = (200 * 77 + 100 * 151 + 50 * 28) >> 8;
		expect([...px]).toEqual([y, y, y, 123]);
	});
});

describe('boxBlur', () => {
	it('is the identity at radius 0', () => {
		const src = makeTestImage(8, 6);
		const dst = new Uint8ClampedArray(src.length);
		boxBlur(src, dst, 8, 6, 0);
		expect(checksum(dst)).toBe(checksum(src));
	});

	it('leaves a uniform image uniform', () => {
		const src = new Uint8ClampedArray(16 * 16 * 4).fill(137);
		const dst = new Uint8ClampedArray(src.length);
		boxBlur(src, dst, 16, 16, 3);
		expect(dst.every((v) => v === 137)).toBe(true);
	});

	it('truncates the integer division like Rust, never rounds', () => {
		// 1×1 image, radius 1: clamp-to-edge makes all 9 taps the same pixel, so
		// acc/taps is exact — extend to a 2×1 so the division actually truncates.
		// Pixels 10 and 15, radius 1 at x=0: taps = 9, column sums (clamped):
		// 3·10 + 3·10 + 3·15 = 105 → 105/9 = 11.67 → must store 11, not 12.
		const src = new Uint8ClampedArray([10, 10, 10, 255, 15, 15, 15, 255]);
		const dst = new Uint8ClampedArray(src.length);
		boxBlur(src, dst, 2, 1, 1);
		expect(dst[0]).toBe(11);
	});
});

describe('scaleInPlace', () => {
	it('stays bit-identical to f32 semantics on exactly-representable data', () => {
		const data = makeFloatData(2048);
		for (let round = 0; round < 5; round++) scaleInPlace(data, 1.5);
		// 1023 · 1.5⁵ = 7768.40625 — exact in f32, so no drift is tolerable.
		expect(data[1023]).toBe(7768.40625);
	});
});

describe('checksum', () => {
	it('is the FNV-1a reference value for known input', () => {
		// FNV-1a of "a" (0x61) = 0xe40c292c — the published test vector.
		expect(checksum(new Uint8Array([0x61]))).toBe('e40c292c');
	});

	it('distinguishes frames differing in one byte', () => {
		const a = makeTestImage(16, 16);
		const b = makeTestImage(16, 16);
		b[100] = b[100] ^ 1;
		expect(checksum(a)).not.toBe(checksum(b));
	});
});

describe('makeTestImage', () => {
	it('is deterministic across calls', () => {
		expect(checksum(makeTestImage(64, 48))).toBe(checksum(makeTestImage(64, 48)));
	});

	it('sets full alpha everywhere', () => {
		const px = makeTestImage(8, 8);
		for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
	});
});

describe('bench statistics', () => {
	it('median handles odd, even and empty inputs', () => {
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 2, 3])).toBe(2.5);
		expect(median([])).toBe(0);
	});

	it('summarize reports median with spread', () => {
		expect(summarize([5, 1, 3])).toEqual({ median: 3, min: 1, max: 5 });
	});

	it('stageStats totals the stages per round before summarizing', () => {
		const stats = stageStats([
			{ copyIn: 1, compute: 10, copyOut: 2 },
			{ copyIn: 3, compute: 20, copyOut: 4 },
		]);
		expect(stats.total.min).toBe(13);
		expect(stats.total.max).toBe(27);
		expect(stats.compute.median).toBe(15);
	});
});
