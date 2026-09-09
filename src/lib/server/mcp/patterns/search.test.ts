import { describe, expect, it } from 'vitest';
import { PATTERNS } from '$lib/server/patterns';
import { scorePatterns, tokenizePatternQuery } from './search';

/**
 * Scoring is purely lexical — no embeddings, no stemmer, no synonym table — so a keyword
 * that does not survive tokenization is dead weight that looks like coverage. `n+1` was
 * exactly that for two records, including the one whose whole subject it is.
 */
describe('tokenizePatternQuery', () => {
	it('keeps a `+` that joins two alphanumerics', () => {
		expect(tokenizePatternQuery('N+1')).toEqual(['nplus1']);
		expect(tokenizePatternQuery('cmd+k')).toEqual(['cmdplusk']);
	});

	it('still splits a `+` used as prose conjunction', () => {
		expect(tokenizePatternQuery('Superforms + Valibot')).toEqual(['superforms', 'valibot']);
	});

	it('normalizes query and keyword identically, which is what makes them meet', () => {
		expect(tokenizePatternQuery('N+1 queries')[0]).toBe(tokenizePatternQuery('n+1')[0]);
	});
});

describe('registry recall', () => {
	// The anti-rot rule the `n+1` defect earned: a keyword nobody can match is worse than a
	// missing one, because the registry reads as if the term were covered.
	it('has no keyword that tokenizes to nothing', () => {
		const inert = PATTERNS.flatMap((pattern) =>
			pattern.keywords
				.filter((keyword) => tokenizePatternQuery(keyword).length === 0)
				.map((keyword) => `${pattern.id}: ${keyword}`),
		);
		expect(inert).toEqual([]);
	});

	it('finds the query-budget card from the problem language a developer would type', () => {
		const ids = scorePatterns('N+1').map((hit) => hit.pattern.id);
		expect(ids).toContain('query-budget');
		expect(ids).toContain('no-waterfall-loading');
	});
});
