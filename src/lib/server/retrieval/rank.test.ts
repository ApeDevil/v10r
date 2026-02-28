import { describe, it, expect } from 'vitest';
import type { RankedChunk } from './types';
import { reciprocalRankFusion, deduplicateAndCap, fuseAndRank } from './rank';
import { RRF_K } from './config';

function makeChunk(id: string, score: number, tier: 1 | 2 | 3 = 1): RankedChunk {
	return {
		chunkId: id,
		documentId: 'doc-1',
		documentTitle: 'Test',
		content: `Content for ${id}`,
		score,
		source: 'vector',
		tier,
	};
}

describe('reciprocalRankFusion', () => {
	it('scores a single list', () => {
		const list = [makeChunk('a', 0.9), makeChunk('b', 0.5)];
		const result = reciprocalRankFusion(list);
		expect(result).toHaveLength(2);
		// First item: 1 / (RRF_K + 0 + 1)
		expect(result[0].chunkId).toBe('a');
		expect(result[0].score).toBeCloseTo(1 / (RRF_K + 1), 10);
	});

	it('boosts overlapping chunks across lists', () => {
		const list1 = [makeChunk('a', 0.9), makeChunk('b', 0.5)];
		const list2 = [makeChunk('a', 0.8), makeChunk('c', 0.7)];
		const result = reciprocalRankFusion(list1, list2);

		// 'a' appears in both lists, should have highest combined score
		expect(result[0].chunkId).toBe('a');
		const expectedScore = 1 / (RRF_K + 1) + 1 / (RRF_K + 1);
		expect(result[0].score).toBeCloseTo(expectedScore, 10);
	});

	it('returns empty for empty input', () => {
		const result = reciprocalRankFusion([]);
		expect(result).toEqual([]);
	});

	it('sorts by descending score', () => {
		const list1 = [makeChunk('a', 0.9)];
		const list2 = [makeChunk('b', 0.8)];
		const list3 = [makeChunk('b', 0.7)];
		const result = reciprocalRankFusion(list1, list2, list3);

		// 'b' appears in list2 and list3 so its fused score should beat 'a'
		expect(result[0].chunkId).toBe('b');
	});
});

describe('deduplicateAndCap', () => {
	it('removes duplicates by chunkId', () => {
		const chunks = [makeChunk('a', 0.9), makeChunk('a', 0.5), makeChunk('b', 0.3)];
		const result = deduplicateAndCap(chunks, 10);
		expect(result).toHaveLength(2);
		expect(result[0].chunkId).toBe('a');
		expect(result[1].chunkId).toBe('b');
	});

	it('caps at maxChunks', () => {
		const chunks = [makeChunk('a', 0.9), makeChunk('b', 0.5), makeChunk('c', 0.3)];
		const result = deduplicateAndCap(chunks, 2);
		expect(result).toHaveLength(2);
	});

	it('returns empty for empty input', () => {
		expect(deduplicateAndCap([], 5)).toEqual([]);
	});
});

describe('fuseAndRank', () => {
	it('groups by tier for RRF then deduplicates', () => {
		const chunks = [
			makeChunk('a', 0.9, 1),
			makeChunk('b', 0.8, 1),
			makeChunk('a', 0.7, 2),
			makeChunk('c', 0.6, 2),
		];
		const { chunks: result } = fuseAndRank(chunks, 10);

		// 'a' appears in both tiers, should rank highest
		expect(result[0].chunkId).toBe('a');
		// No duplicates
		const ids = result.map((c) => c.chunkId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('passes through single tier without RRF', () => {
		const chunks = [makeChunk('a', 0.9, 1), makeChunk('b', 0.5, 1)];
		const { chunks: result } = fuseAndRank(chunks, 10);
		expect(result).toHaveLength(2);
		expect(result[0].chunkId).toBe('a');
	});

	it('returns empty entities array', () => {
		const { entities } = fuseAndRank([], 10);
		expect(entities).toEqual([]);
	});
});
