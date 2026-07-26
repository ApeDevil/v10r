import { describe, expect, it } from 'vitest';
import { averageLuminance, dominantColors } from './palette';

/** Build an RGBA buffer from [r,g,b,a] tuples repeated `n` times each. */
function pixels(...runs: Array<{ rgba: [number, number, number, number]; n: number }>): Uint8ClampedArray {
	const total = runs.reduce((sum, r) => sum + r.n, 0);
	const buf = new Uint8ClampedArray(total * 4);
	let i = 0;
	for (const run of runs) {
		for (let k = 0; k < run.n; k++) {
			buf.set(run.rgba, i);
			i += 4;
		}
	}
	return buf;
}

const RED: [number, number, number, number] = [255, 0, 0, 255];
const GREEN: [number, number, number, number] = [0, 255, 0, 255];
const BLUE: [number, number, number, number] = [0, 0, 255, 255];

describe('dominantColors', () => {
	it('returns nothing for an empty buffer', () => {
		expect(dominantColors(new Uint8ClampedArray(0))).toEqual([]);
		expect(dominantColors(new Uint8ClampedArray(2))).toEqual([]);
	});

	it('finds a single flat colour', () => {
		const result = dominantColors(pixels({ rgba: RED, n: 10 }));
		expect(result).toHaveLength(1);
		expect(result[0].hex).toBe('#ff0000');
		expect(result[0].share).toBe(1);
	});

	it('orders buckets by weight', () => {
		const result = dominantColors(pixels({ rgba: RED, n: 5 }, { rgba: GREEN, n: 20 }, { rgba: BLUE, n: 10 }));
		expect(result.map((s) => s.hex)).toEqual(['#00ff00', '#0000ff', '#ff0000']);
	});

	it('reports shares that sum to the counted fraction', () => {
		const result = dominantColors(pixels({ rgba: RED, n: 25 }, { rgba: BLUE, n: 75 }));
		expect(result[0].share).toBeCloseTo(0.75, 5);
		expect(result[1].share).toBeCloseTo(0.25, 5);
	});

	it('honours the requested swatch count', () => {
		const result = dominantColors(pixels({ rgba: RED, n: 3 }, { rgba: GREEN, n: 2 }, { rgba: BLUE, n: 1 }), 2);
		expect(result).toHaveLength(2);
	});

	it('groups near-identical colours into one bucket', () => {
		// Quantisation drops the low 3 bits, so these collapse together.
		const result = dominantColors(pixels({ rgba: [250, 2, 2, 255], n: 4 }, { rgba: [252, 0, 0, 255], n: 4 }));
		expect(result).toHaveLength(1);
		expect(result[0].share).toBe(1);
	});

	it('ignores transparent pixels rather than reading them as black', () => {
		const result = dominantColors(pixels({ rgba: RED, n: 4 }, { rgba: [0, 0, 0, 0], n: 100 }));
		expect(result).toHaveLength(1);
		expect(result[0].hex).toBe('#ff0000');
		expect(result[0].share).toBe(1);
	});

	it('returns nothing when every pixel is transparent', () => {
		expect(dominantColors(pixels({ rgba: [10, 20, 30, 0], n: 8 }))).toEqual([]);
	});

	it('is deterministic — the demo compares main-thread and worker output', () => {
		const buf = pixels({ rgba: RED, n: 7 }, { rgba: GREEN, n: 7 }, { rgba: BLUE, n: 3 });
		expect(dominantColors(buf)).toEqual(dominantColors(buf));
	});
});

describe('averageLuminance', () => {
	it('is 1 for white and 0 for black', () => {
		expect(averageLuminance(pixels({ rgba: [255, 255, 255, 255], n: 4 }))).toBeCloseTo(1, 5);
		expect(averageLuminance(pixels({ rgba: [0, 0, 0, 255], n: 4 }))).toBe(0);
	});

	it('weights green above red above blue', () => {
		const r = averageLuminance(pixels({ rgba: RED, n: 1 }));
		const g = averageLuminance(pixels({ rgba: GREEN, n: 1 }));
		const b = averageLuminance(pixels({ rgba: BLUE, n: 1 }));
		expect(g).toBeGreaterThan(r);
		expect(r).toBeGreaterThan(b);
	});

	it('skips transparent pixels', () => {
		expect(averageLuminance(pixels({ rgba: [255, 255, 255, 255], n: 2 }, { rgba: [0, 0, 0, 0], n: 50 }))).toBeCloseTo(
			1,
			5,
		);
	});

	it('is 0 for an empty or fully transparent buffer', () => {
		expect(averageLuminance(new Uint8ClampedArray(0))).toBe(0);
		expect(averageLuminance(pixels({ rgba: [9, 9, 9, 0], n: 3 }))).toBe(0);
	});
});
