import { describe, expect, it } from 'vitest';
import { SIMILARITY_FLOOR } from './config';
import { normalizeName } from './normalize';
import { bestSimilarity, bigramDice, colognePhonetic, levenshtein, scoreSimilarity, tokenJaccard } from './similarity';

const velora = normalizeName('Velora');

describe('primitives', () => {
	it('levenshtein counts edits', () => {
		expect(levenshtein('velora', 'velora')).toBe(0);
		expect(levenshtein('velora', 'veloro')).toBe(1);
		expect(levenshtein('kitten', 'sitting')).toBe(3);
		expect(levenshtein('', 'abc')).toBe(3);
	});

	it('bigram dice is 1 for equal and 0 for disjoint strings', () => {
		expect(bigramDice('velora', 'velora')).toBe(1);
		expect(bigramDice('abcd', 'wxyz')).toBe(0);
	});

	it('token jaccard shares two of four', () => {
		expect(tokenJaccard(['blue', 'fox', 'studio'], ['blue', 'fox', 'interactive'])).toBe(0.5);
	});

	it('Kölner Phonetik keys the textbook and the spec examples', () => {
		expect(colognePhonetic('mueller-luedenscheidt')).toBe('65752682');
		expect(colognePhonetic('Meier')).toBe(colognePhonetic('Mayr'));
		expect(colognePhonetic('synex')).toBe('8648');
		expect(colognePhonetic('cinex')).toBe('8648');
		expect(colognePhonetic('')).toBe('');
	});
});

describe('scoreSimilarity', () => {
	it('follows the spec ladder, in order', () => {
		const exact = scoreSimilarity(velora, 'Velora');
		const normalized = scoreSimilarity(velora, 'Velo-Ra');
		const spelling = scoreSimilarity(velora, 'Veloro');
		const phonetic = scoreSimilarity(normalizeName('Synex'), 'Cinex');
		const token = scoreSimilarity(velora, 'Velora Labs');
		const loose = scoreSimilarity(velora, 'Valorant');

		expect(exact).toEqual({ score: 100, basis: 'exact' });
		expect(normalized).toEqual({ score: 100, basis: 'normalized' });
		expect(spelling).toEqual({ score: 94, basis: 'spelling' });
		expect(phonetic).toEqual({ score: 88, basis: 'phonetic' });
		expect(token).toEqual({ score: 81, basis: 'token' });
		expect(loose.basis).toBe('loose');
		expect(loose.score).toBeGreaterThanOrEqual(SIMILARITY_FLOOR);
		expect(loose.score).toBeLessThan(70);
	});

	it('meets a registry spelling with a legal form as a normalised match', () => {
		expect(scoreSimilarity(velora, 'Velora OÜ')).toEqual({ score: 100, basis: 'normalized' });
	});

	it('shares the dominant tokens of a multi-word name', () => {
		const studio = normalizeName('Blue Fox Studio');
		const result = scoreSimilarity(studio, 'Blue Fox Interactive');
		expect(result.basis).toBe('token');
		expect(result.score).toBeGreaterThanOrEqual(78);
	});

	it('grades a glued name by affix containment', () => {
		const result = scoreSimilarity(velora, 'Velorasoft');
		expect(result.basis).toBe('affix');
		expect(result.score).toBeGreaterThanOrEqual(SIMILARITY_FLOOR);
	});

	it('drops an unrelated name below the floor', () => {
		expect(scoreSimilarity(velora, 'Velvet').score).toBeLessThan(SIMILARITY_FLOOR);
		expect(scoreSimilarity(velora, 'Zanzibar Holdings').score).toBeLessThan(SIMILARITY_FLOOR);
	});

	it('bestSimilarity takes the strongest alias', () => {
		expect(bestSimilarity(velora, ['Some page title', 'velora'])).toEqual({ score: 100, basis: 'exact' });
		expect(bestSimilarity(velora, ['Some page title', 'velora-labs']).basis).toBe('token');
	});
});
