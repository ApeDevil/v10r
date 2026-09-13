/**
 * Reciprocal rank fusion and the tier-grouping wrapper over it.
 *
 * `reciprocalRankFusion` is generic over the key it fuses by; the chunk layer fuses by
 * `chunkId`, and a second, page-keyed shape is exercised below to keep it that way.
 */
import { describe, expect, it } from 'vitest';
import { RRF_K } from './config';
import { deduplicateAndCap, fuseAndRank, reciprocalRankFusion } from './rank';
import type { RankedChunk } from './types';

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

const byChunkId = (chunk: RankedChunk) => chunk.chunkId;

describe('reciprocalRankFusion', () => {
	it('scores a single list', () => {
		const result = reciprocalRankFusion([[makeChunk('a', 0.9), makeChunk('b', 0.5)]], byChunkId);
		expect(result).toHaveLength(2);
		expect(result[0].chunkId).toBe('a');
		expect(result[0].score).toBeCloseTo(1 / (RRF_K + 1), 10);
	});

	it('boosts overlapping chunks across lists', () => {
		const result = reciprocalRankFusion(
			[
				[makeChunk('a', 0.9), makeChunk('b', 0.5)],
				[makeChunk('a', 0.8), makeChunk('c', 0.7)],
			],
			byChunkId,
		);
		expect(result[0].chunkId).toBe('a');
		expect(result[0].score).toBeCloseTo(1 / (RRF_K + 1) + 1 / (RRF_K + 1), 10);
	});

	it('returns empty for no lists and for one empty list', () => {
		expect(reciprocalRankFusion<RankedChunk>([], byChunkId)).toEqual([]);
		expect(reciprocalRankFusion<RankedChunk>([[]], byChunkId)).toEqual([]);
	});

	it('sorts by descending score', () => {
		const result = reciprocalRankFusion(
			[[makeChunk('a', 0.9)], [makeChunk('b', 0.8)], [makeChunk('b', 0.7)]],
			byChunkId,
		);
		// 'b' appears in two of the three lists, so its fused score beats 'a'.
		expect(result[0].chunkId).toBe('b');
	});

	/**
	 * Regression, both halves demonstrated before the fix.
	 *
	 * The previous implementation carried a "keep the higher individual score's metadata"
	 * branch that wrote the ACCUMULATED score back onto the stored chunk, then compared the
	 * next raw score (0-1) against it (~0.03). From the third list onward that comparison was
	 * always true, so the LAST list won — inverting the rule it claimed to implement — and the
	 * write itself mutated an object the caller still owned.
	 */
	it('keeps one metadata copy deterministically across three lists', () => {
		const result = reciprocalRankFusion(
			[[makeChunk('a', 0.95)], [makeChunk('a', 0.4)], [makeChunk('a', 0.1)]],
			byChunkId,
		);
		expect(result).toHaveLength(1);
		expect(result[0].content).toBe('Content for a');
		expect(result[0].score).toBeCloseTo(3 * (1 / (RRF_K + 1)), 10);
	});

	it('does not mutate the lists it was given', () => {
		const tier1 = [makeChunk('a', 0.95)];
		const tier2 = [makeChunk('a', 0.4)];
		const tier3 = [makeChunk('a', 0.1)];

		reciprocalRankFusion([tier1, tier2, tier3], byChunkId);

		expect(tier1[0].score).toBe(0.95);
		expect(tier2[0].score).toBe(0.4);
		expect(tier3[0].score).toBe(0.1);
	});

	it('fuses any shape given an identity function, not just chunks', () => {
		const page = (id: string) => ({ pageId: id, title: id, score: 0 });
		const result = reciprocalRankFusion(
			[
				[page('shared'), page('a-only')],
				[page('shared'), page('b-only')],
			],
			(p) => p.pageId,
		);
		expect(result.map((p) => p.pageId)).toHaveLength(3);
		expect(result[0].pageId).toBe('shared');
		expect(result[0].score).toBeGreaterThan(result[1].score);
	});
});

describe('deduplicateAndCap', () => {
	it('removes duplicates by chunkId', () => {
		const result = deduplicateAndCap([makeChunk('a', 0.9), makeChunk('a', 0.5), makeChunk('b', 0.3)], 10);
		expect(result.map((c) => c.chunkId)).toEqual(['a', 'b']);
	});

	it('caps at maxChunks', () => {
		expect(deduplicateAndCap([makeChunk('a', 0.9), makeChunk('b', 0.5), makeChunk('c', 0.3)], 2)).toHaveLength(2);
	});

	it('returns empty for empty input', () => {
		expect(deduplicateAndCap([], 5)).toEqual([]);
	});
});

describe('fuseAndRank', () => {
	it('groups by tier for RRF then deduplicates', () => {
		const chunks = [makeChunk('a', 0.9, 1), makeChunk('b', 0.8, 1), makeChunk('a', 0.7, 2), makeChunk('c', 0.6, 2)];
		const { chunks: result } = fuseAndRank(chunks, 10);

		expect(result[0].chunkId).toBe('a');
		const ids = result.map((c) => c.chunkId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	// retrieval/index.ts reads tier provenance off the PRE-fusion list precisely because this
	// call does not copy its input; a mutating fusion would corrupt that read.
	it('leaves the caller-owned array it groups untouched', () => {
		const chunks = [makeChunk('a', 0.9, 1), makeChunk('a', 0.7, 2), makeChunk('a', 0.5, 3)];
		fuseAndRank(chunks, 10);
		expect(chunks.map((c) => c.score)).toEqual([0.9, 0.7, 0.5]);
		expect(chunks.map((c) => c.tier)).toEqual([1, 2, 3]);
	});

	it('passes through single tier without RRF', () => {
		const { chunks: result } = fuseAndRank([makeChunk('a', 0.9, 1), makeChunk('b', 0.5, 1)], 10);
		expect(result).toHaveLength(2);
		expect(result[0].chunkId).toBe('a');
	});

	it('handles empty input', () => {
		expect(fuseAndRank([], 10).chunks).toEqual([]);
	});
});
