import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineStepEvent } from '$lib/types/pipeline';
import type { RankedChunk } from './types';

const mockGenerateEmbedding = vi.fn();
const mockSearchContextual = vi.fn();
const mockSearchParentChild = vi.fn();
const mockSearchGraph = vi.fn();

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
	getGraphEntities: vi.fn().mockResolvedValue([]),
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
	});

	it('single tier retrieval (tier 1 only)', async () => {
		const chunks = [makeChunk('c1', 1)];
		mockSearchContextual.mockResolvedValue(chunks);

		const result = await retrieve('test query', { userId: 'u1', tiers: [1] });

		expect(mockSearchContextual).toHaveBeenCalled();
		expect(mockSearchParentChild).not.toHaveBeenCalled();
		expect(mockSearchGraph).not.toHaveBeenCalled();
		expect(result.chunks).toHaveLength(1);
		expect(result.tierUsed).toEqual([1]);
	});

	it('multi-tier parallel retrieval', async () => {
		mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);
		mockSearchParentChild.mockResolvedValue([makeChunk('c2', 2)]);

		const result = await retrieve('test query', { userId: 'u1', tiers: [1, 2] });

		expect(mockSearchContextual).toHaveBeenCalled();
		expect(mockSearchParentChild).toHaveBeenCalled();
		expect(result.tierUsed).toEqual([1, 2]);
	});

	it('failed tier returns empty, does not break pipeline', async () => {
		mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);
		mockSearchParentChild.mockRejectedValue(new Error('tier 2 failed'));

		const result = await retrieve('test query', { userId: 'u1', tiers: [1, 2] });

		expect(result.chunks.length).toBeGreaterThanOrEqual(1);
	});

	it('onEvent receives step events in order', async () => {
		mockSearchContextual.mockResolvedValue([makeChunk('c1', 1)]);

		const events: PipelineStepEvent[] = [];
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

		const events: PipelineStepEvent[] = [];
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
