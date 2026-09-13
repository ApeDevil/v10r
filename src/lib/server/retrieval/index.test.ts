import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetrievalStepEvent } from '$lib/types/retrieval-trace';
import type { RankedChunk } from './types';

const mockGenerateEmbedding = vi.fn();
const mockSearchContextual = vi.fn();
const mockSearchParentChild = vi.fn();
const mockSearchGraph = vi.fn();
const mockGetGraphEntities = vi.fn();

vi.mock('./embed', () => ({
	generateEmbedding: mockGenerateEmbedding,
}));

vi.mock('./tiers/contextual', () => ({
	searchContextual: mockSearchContextual,
}));

vi.mock('./tiers/parent-child', () => ({
	searchParentChild: mockSearchParentChild,
}));

vi.mock('./tiers/graph', () => ({
	searchGraph: mockSearchGraph,
	getGraphEntities: mockGetGraphEntities,
}));

const { retrieve, formatContextForPrompt } = await import('./index');

function makeChunk(id: string, tier: 1 | 2 | 3, score = 0.9): RankedChunk {
	return {
		chunkId: id,
		documentId: `doc-${id}`,
		documentTitle: `Doc ${id}`,
		content: `Content of chunk ${id}`,
		score,
		source: 'vector',
		tier,
	};
}

describe('retrieve', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0));
		mockSearchContextual.mockResolvedValue([]);
		mockSearchParentChild.mockResolvedValue([]);
		mockSearchGraph.mockResolvedValue([]);
		mockGetGraphEntities.mockResolvedValue([]);
	});

	/**
	 * The corpus boundary inside a tenant: a caller's `source` reaches both vector tiers, and
	 * a caller that names none gets the unscoped queries the chatbot relies on.
	 */
	describe('source scope', () => {
		it('threads the requested source into tiers 1 and 2', async () => {
			await retrieve('budget', { userId: 'u1', tiers: [1, 2], source: 'desk' });
			expect(mockSearchContextual).toHaveBeenCalledWith('budget', expect.any(Array), expect.any(Number), 'u1', 'desk');
			expect(mockSearchParentChild).toHaveBeenCalledWith(expect.any(Array), expect.any(Number), 'u1', 'desk');
		});

		it('leaves the tiers unscoped when no source is named', async () => {
			await retrieve('budget', { userId: 'u1', tiers: [1] });
			expect(mockSearchContextual).toHaveBeenCalledWith(
				'budget',
				expect.any(Array),
				expect.any(Number),
				'u1',
				undefined,
			);
		});
	});

	/**
	 * The other half of the `embed_calls_per_turn` budget. The chatbot embeds the user
	 * message once and hands the vector to both consumers (proved in
	 * `ai/profile/chatbot.test.ts`); this is the consumer keeping its side of it. A
	 * shared vector that gets re-embedded here is a shared vector in name only, and the
	 * cost — one extra Gemini call against a ~1000/day ceiling — is invisible until the
	 * quota board runs dry.
	 */
	describe('supplied query vector', () => {
		it('reuses a caller-supplied embedding instead of computing its own', async () => {
			const shared = new Array(1536).fill(0.5);

			await retrieve('test query', { userId: 'u1', queryEmbedding: shared });

			expect(mockGenerateEmbedding).not.toHaveBeenCalled();
			// Identity, not equality: an equal-but-different array would mean a second
			// provider call produced it.
			expect(mockSearchContextual.mock.calls[0]).toContain(shared);
		});

		it('embeds for itself when no vector is supplied', async () => {
			await retrieve('test query', { userId: 'u1' });

			expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
		});
	});

	/**
	 * The graph round-trip is a blocking Neo4j call on the response path, so it must fire when
	 * — and only when — the graph tier actually contributed a chunk that survived fusion.
	 *
	 * Provenance is read from the pre-fusion lists rather than from the surviving chunk's own
	 * `tier`, because fusion collapses a chunk found by two tiers into one object. When that
	 * decision hung on which copy won, a tier-1 result carrying tier 3's metadata triggered the
	 * call for nothing — the exact cost the guard exists to avoid.
	 */
	describe('graph entity lookup', () => {
		it('fetches entities when a graph-only chunk survives', async () => {
			mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);
			mockSearchGraph.mockResolvedValue([{ ...makeChunk('g1', 3), source: 'graph' as const }]);

			await retrieve('test query', { userId: 'u1', tiers: [1, 3] });

			expect(mockGetGraphEntities).toHaveBeenCalled();
		});

		it('fetches entities when the same chunk was found by both tier 1 and tier 3', async () => {
			mockSearchContextual.mockResolvedValue([makeChunk('shared', 1)]);
			mockSearchGraph.mockResolvedValue([{ ...makeChunk('shared', 3), source: 'graph' as const }]);

			await retrieve('test query', { userId: 'u1', tiers: [1, 3] });

			expect(mockGetGraphEntities).toHaveBeenCalled();
		});

		it('skips the round-trip when the graph tier contributed nothing', async () => {
			mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);
			mockSearchGraph.mockResolvedValue([]);

			await retrieve('test query', { userId: 'u1', tiers: [1, 3] });

			expect(mockGetGraphEntities).not.toHaveBeenCalled();
		});

		it('skips the round-trip when tier 3 was never requested', async () => {
			mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);

			await retrieve('test query', { userId: 'u1', tiers: [1] });

			expect(mockGetGraphEntities).not.toHaveBeenCalled();
		});
	});

	/**
	 * The dispatch contract, not the tiers themselves: a tier that was not asked for must
	 * never be queried — tier 3 reaches Neo4j, so a stray call is a real cost. Each tier's
	 * own behaviour is tested in its own module; this only pins which ones run.
	 */
	it.each([
		{ tiers: [1], called: [true, false, false] },
		{ tiers: [1, 2], called: [true, true, false] },
		{ tiers: [2, 3], called: [false, true, true] },
	] as const)('queries exactly the requested tiers $tiers', async ({ tiers, called }) => {
		mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);
		mockSearchParentChild.mockResolvedValue([makeChunk('c2', 2)]);
		mockSearchGraph.mockResolvedValue([makeChunk('c3', 3)]);

		const result = await retrieve('test query', { userId: 'u1', tiers: [...tiers] });

		const mocks = [mockSearchContextual, mockSearchParentChild, mockSearchGraph];
		mocks.forEach((mock, i) => {
			if (called[i]) expect(mock, `tier ${i + 1}`).toHaveBeenCalled();
			else expect(mock, `tier ${i + 1}`).not.toHaveBeenCalled();
		});
		expect(result.tierUsed).toEqual([...tiers]);
	});

	it('failed tier returns empty, does not break pipeline', async () => {
		mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);
		mockSearchParentChild.mockRejectedValue(new Error('tier 2 failed'));

		const result = await retrieve('test query', { userId: 'u1', tiers: [1, 2] });

		expect(result.chunks.length).toBeGreaterThanOrEqual(1);
	});

	it('onEvent receives step events in order', async () => {
		mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);

		const events: RetrievalStepEvent[] = [];
		await retrieve('test query', { userId: 'u1', tiers: [1] }, (e) => {
			if (e.type === 'pipeline:step') events.push(e);
		});

		const steps = events.map((e) => e.step);
		expect(steps).toContain('embed');
		expect(steps).toContain('tier-1');
		expect(steps).toContain('rank');
		expect(steps).toContain('context');
	});

	it('unused tiers emitted as skipped', async () => {
		mockSearchContextual.mockResolvedValue([]);

		const events: RetrievalStepEvent[] = [];
		await retrieve('test query', { userId: 'u1', tiers: [1] }, (e) => {
			if (e.type === 'pipeline:step') events.push(e);
		});

		const skipped = events.filter((e) => e.status === 'skipped');
		const skippedSteps = skipped.map((e) => e.step);
		expect(skippedSteps).toContain('tier-2');
		expect(skippedSteps).toContain('tier-3');
	});
});

describe('formatContextForPrompt', () => {
	it('formats chunks with titles', () => {
		const result = formatContextForPrompt({
			chunks: [makeChunk('c1', 1), makeChunk('c2', 1)],
			entities: [],
			tierUsed: [1],
			durationMs: 100,
		});

		expect(result).toContain('[1] Doc c1');
		expect(result).toContain('[2] Doc c2');
		expect(result).toContain('Content of chunk c1');
	});

	it('returns empty string for no chunks', () => {
		const result = formatContextForPrompt({
			chunks: [],
			entities: [],
			tierUsed: [1],
			durationMs: 0,
		});

		expect(result).toBe('');
	});
});
