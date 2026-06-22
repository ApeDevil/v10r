import { describe, expect, it } from 'vitest';
import { IMAGE_KIT_CORPUS } from './corpus';
import { cosineSimilarity, l2Norm, neighborsFrom } from './embed';

describe('l2Norm', () => {
	it('is the Euclidean magnitude', () => {
		expect(l2Norm([3, 4])).toBeCloseTo(5);
	});
	it('is 0 for the zero vector', () => {
		expect(l2Norm([0, 0, 0])).toBe(0);
	});
});

describe('cosineSimilarity', () => {
	it('is 1 for identical vectors', () => {
		expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
	});
	it('is 0 for orthogonal vectors', () => {
		expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
	});
	it('is -1 for opposite vectors', () => {
		expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1);
	});
	it('returns 0 on length mismatch or empty input (no throw)', () => {
		expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
		expect(cosineSimilarity([], [])).toBe(0);
	});
});

describe('neighborsFrom', () => {
	const corpus = [
		{ label: 'A', vector: [1, 0] },
		{ label: 'B', vector: [0, 1] },
		{ label: 'C', vector: [1, 1] },
	];
	it('sorts by descending similarity', () => {
		const out = neighborsFrom([1, 0], corpus);
		expect(out.map((n) => n.label)).toEqual(['A', 'C', 'B']);
		expect(out[0].similarity).toBeGreaterThanOrEqual(out[1].similarity);
		expect(out[1].similarity).toBeGreaterThanOrEqual(out[2].similarity);
	});
});

describe('IMAGE_KIT_CORPUS', () => {
	it('has a non-trivial fixed set of labelled captions', () => {
		expect(IMAGE_KIT_CORPUS.length).toBeGreaterThanOrEqual(6);
		for (const entry of IMAGE_KIT_CORPUS) {
			expect(entry.label.length).toBeGreaterThan(0);
			expect(entry.text.length).toBeGreaterThan(0);
		}
	});
});
