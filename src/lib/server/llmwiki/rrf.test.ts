/**
 * Unit tests for the reciprocal-rank-fusion helper.
 * Pure function — no mocks required beyond the module boundary.
 */
import { describe, expect, it, vi } from 'vitest';

// rrf imports from './config' only; no db or embed imports pull in env.
vi.mock('$lib/server/rawrag/embed', () => ({
	generateEmbedding: vi.fn(),
}));
vi.mock('$lib/server/db', () => ({ db: {} }));

const { rrf } = await import('./search');

function page(id: string) {
	return { pageId: id, slug: `s-${id}`, title: id, tldr: '', tags: [], score: 0 };
}

describe('rrf', () => {
	it('returns empty array for empty input', () => {
		expect(rrf([])).toEqual([]);
		expect(rrf([[]])).toEqual([]);
	});

	it('fuses two lists so shared pages outrank exclusive ones', () => {
		const listA = [page('shared'), page('a-only')];
		const listB = [page('shared'), page('b-only')];
		const result = rrf([listA, listB]);
		expect(result[0].pageId).toBe('shared');
		expect(result.length).toBe(3);
	});

	it('dedupes pages across lists (each pageId appears once)', () => {
		const listA = [page('x'), page('y'), page('z')];
		const listB = [page('x'), page('z'), page('y')];
		const result = rrf([listA, listB]);
		const ids = result.map((r) => r.pageId).sort();
		expect(ids).toEqual(['x', 'y', 'z']);
	});

	it('orders higher-ranked pages first within a single list', () => {
		const listA = [page('first'), page('second'), page('third')];
		const result = rrf([listA]);
		expect(result.map((r) => r.pageId)).toEqual(['first', 'second', 'third']);
	});

	it('gives a page appearing at rank 1 in both lists a higher fused score than a rank-1-in-one-only page', () => {
		const listA = [page('winner'), page('a-only')];
		const listB = [page('winner'), page('b-only')];
		const result = rrf([listA, listB]);
		expect(result[0].pageId).toBe('winner');
		expect(result[0].score).toBeGreaterThan(result[1].score);
	});
});
