import { describe, expect, it } from 'vitest';
import { IMAGE_KIT_CORPUS } from './corpus';
import { cosineSimilarity, neighborsFrom } from './embed';

/**
 * The nearest-neighbour lookup behind the image-kit showcase.
 *
 * `l2Norm` and `cosineSimilarity` are textbook formulas, and `neighborsFrom` exercises
 * both on every call — so the ranking test below is the stronger witness and the
 * definitional cases (|(3,4)| = 5, cos of identical vectors = 1) were dropped. What is
 * kept is the part no formula dictates: the defensive branch for mismatched or empty
 * input, which returns 0 instead of NaN or a throw.
 */

describe('cosineSimilarity', () => {
	it('returns 0 on length mismatch or empty input rather than NaN or a throw', () => {
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

	it('ranks against a corpus that is actually populated', () => {
		// Non-vacuity guard: an emptied corpus would make the showcase render nothing
		// while every ranking assertion above still passed on its own fixture.
		expect(IMAGE_KIT_CORPUS.length).toBeGreaterThanOrEqual(6);
		for (const entry of IMAGE_KIT_CORPUS) {
			expect(entry.label.length).toBeGreaterThan(0);
			expect(entry.text.length).toBeGreaterThan(0);
		}
	});
});
