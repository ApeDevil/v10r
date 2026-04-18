import { describe, expect, it } from 'vitest';
import type {
	ChunkSummary,
	LlmwikiCitationsEvent,
	PipelineChunksEvent,
	PipelinePromptEvent,
	PipelineStepEvent,
} from '$lib/types/pipeline';
import { createLlmwikiTrace } from './llmwiki-trace.svelte';

function pageChunk(id: string): ChunkSummary {
	return {
		chunkId: id,
		documentId: `doc-${id}`,
		documentTitle: `Page ${id}`,
		contentPreview: `tldr for ${id}`,
		contentLength: 100,
		score: 0.9,
		source: 'llmwiki',
		tier: 'llmwiki',
		survived: true,
	};
}

function drilledChunk(id: string, reason: ChunkSummary['survivalReason']): ChunkSummary {
	return {
		chunkId: id,
		documentId: `doc-${id}`,
		documentTitle: `Source ${id}`,
		contentPreview: `raw content of ${id}`,
		contentLength: 200,
		score: 1.0,
		source: 'vector',
		tier: 1,
		survived: true,
		survivalReason: reason,
	};
}

describe('createLlmwikiTrace', () => {
	it('initial base steps are all pending; no drill steps yet', () => {
		const t = createLlmwikiTrace();
		for (const s of t.baseSteps) expect(s.status).toBe('pending');
		expect(t.drillSteps).toHaveLength(0);
		expect(t.drillCount).toBe(0);
		expect(t.isActive).toBe(false);
		expect(t.totalDurationMs).toBe(0);
		expect(t.summaryLabel).toBe('');
	});

	it('processes a base step event and marks it done', () => {
		const t = createLlmwikiTrace();
		const event: PipelineStepEvent = {
			type: 'pipeline:step',
			step: 'llmwiki:search',
			status: 'done',
			durationMs: 42,
		};
		t.processAnnotations([event]);
		const search = t.baseSteps.find((s) => s.id === 'llmwiki:search');
		expect(search?.status).toBe('done');
		expect(search?.durationMs).toBe(42);
	});

	it('accumulates drill steps dynamically (no pre-allocation)', () => {
		const t = createLlmwikiTrace();
		const evs: PipelineStepEvent[] = [
			{ type: 'pipeline:step', step: 'rawrag:drill', status: 'done', durationMs: 50, detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 } },
			{ type: 'pipeline:step', step: 'rawrag:drill', status: 'done', durationMs: 30, detail: { kind: 'drill', callIndex: 1, idsRequested: 2, chunksReturned: 2 } },
		];
		t.processAnnotations(evs);
		expect(t.drillCount).toBe(2);
		expect(t.drillSteps[0].label).toBe('Drill #1');
		expect(t.drillSteps[1].label).toBe('Drill #2');
	});

	it('zero-drill turn leaves drill list empty', () => {
		const t = createLlmwikiTrace();
		t.processAnnotations([
			{ type: 'pipeline:step', step: 'llmwiki:search', status: 'done', durationMs: 20 } satisfies PipelineStepEvent,
			{ type: 'pipeline:step', step: 'generate', status: 'done', durationMs: 300 } satisfies PipelineStepEvent,
		]);
		expect(t.drillCount).toBe(0);
	});

	it('steps() interleaves drill steps between generate and verify', () => {
		const t = createLlmwikiTrace();
		t.processAnnotations([
			{ type: 'pipeline:step', step: 'rawrag:drill', status: 'done', durationMs: 10, detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 } } satisfies PipelineStepEvent,
		]);
		const ids = t.steps.map((s) => s.id);
		const generateIdx = ids.indexOf('generate');
		const verifyIdx = ids.indexOf('llmwiki:verify');
		const drillIdx = ids.lastIndexOf('rawrag:drill');
		expect(drillIdx).toBeGreaterThan(generateIdx);
		expect(drillIdx).toBeLessThan(verifyIdx);
	});

	it('processes pipeline:chunks (llmwiki hits + drilled chunks)', () => {
		const t = createLlmwikiTrace();
		const chunks: PipelineChunksEvent = {
			type: 'pipeline:chunks',
			tierChunks: { llmwiki: [pageChunk('p1'), pageChunk('p2')] },
			rankedChunks: [],
			contextChunks: [drilledChunk('c1', 'drilled-cited')],
		};
		t.processAnnotations([chunks]);
		expect(t.pages).toHaveLength(2);
		expect(t.drilledChunks).toHaveLength(1);
		expect(t.drilledChunks[0].survivalReason).toBe('drilled-cited');
	});

	it('processes pipeline:prompt_assembled', () => {
		const t = createLlmwikiTrace();
		const prompt: PipelinePromptEvent = {
			type: 'pipeline:prompt_assembled',
			systemPrompt: 'sys',
			userPrompt: 'u',
			contextBlocks: [],
			totalTokens: 100,
		};
		t.processAnnotations([prompt]);
		expect(t.assembledPrompt?.totalTokens).toBe(100);
	});

	it('processes llmwiki:citations and exposes verdicts', () => {
		const t = createLlmwikiTrace();
		const evt: LlmwikiCitationsEvent = {
			type: 'llmwiki:citations',
			verdicts: [
				{ pageSlug: 'p1', chunkId: 'c1', status: 'quote' },
				{ pageSlug: 'p2', chunkId: null, status: 'none' },
			],
			summary: { total: 2, quote: 1, paraphrase: 0, drifted: 0, uncited: 0 },
		};
		t.processAnnotations([evt]);
		expect(t.citations?.summary.quote).toBe(1);
		expect(t.verdictForChunk('c1')?.status).toBe('quote');
		expect(t.verdictForChunk('unknown')).toBeNull();
	});

	it('annotation cursor is idempotent — reprocessing does not duplicate drill steps', () => {
		const t = createLlmwikiTrace();
		const evs: PipelineStepEvent[] = [
			{ type: 'pipeline:step', step: 'rawrag:drill', status: 'done', durationMs: 10, detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 } },
		];
		t.processAnnotations(evs);
		t.processAnnotations(evs);
		expect(t.drillCount).toBe(1);
	});

	it('summaryLabel formats "N pages · M drills" correctly', () => {
		const t = createLlmwikiTrace();
		const annotations: unknown[] = [
			{
				type: 'pipeline:chunks',
				tierChunks: { llmwiki: [pageChunk('p1'), pageChunk('p2'), pageChunk('p3')] },
				rankedChunks: [],
				contextChunks: [],
			} satisfies PipelineChunksEvent,
		];
		t.processAnnotations(annotations);
		expect(t.summaryLabel).toBe('3 pages');
		annotations.push({
			type: 'pipeline:step',
			step: 'rawrag:drill',
			status: 'done',
			durationMs: 10,
			detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 },
		} satisfies PipelineStepEvent);
		t.processAnnotations(annotations);
		expect(t.summaryLabel).toBe('3 pages · 1 drill');
	});

	it('isActive reflects any active step in either base or drill lists', () => {
		const t = createLlmwikiTrace();
		t.processAnnotations([
			{ type: 'pipeline:step', step: 'llmwiki:search', status: 'active' } satisfies PipelineStepEvent,
		]);
		expect(t.isActive).toBe(true);
	});

	it('totalDurationMs sums base + drill durations', () => {
		const t = createLlmwikiTrace();
		t.processAnnotations([
			{ type: 'pipeline:step', step: 'llmwiki:search', status: 'done', durationMs: 20 } satisfies PipelineStepEvent,
			{ type: 'pipeline:step', step: 'rawrag:drill', status: 'done', durationMs: 10, detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 } } satisfies PipelineStepEvent,
			{ type: 'pipeline:step', step: 'llmwiki:verify', status: 'done', durationMs: 5 } satisfies PipelineStepEvent,
		]);
		expect(t.totalDurationMs).toBe(35);
	});

	it('reset clears all state and cursor', () => {
		const t = createLlmwikiTrace();
		t.processAnnotations([
			{ type: 'pipeline:step', step: 'llmwiki:search', status: 'done', durationMs: 20 } satisfies PipelineStepEvent,
			{ type: 'pipeline:step', step: 'rawrag:drill', status: 'done', durationMs: 10, detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 } } satisfies PipelineStepEvent,
		]);
		t.selectStep('llmwiki:search');
		t.reset();
		expect(t.baseSteps.every((s) => s.status === 'pending')).toBe(true);
		expect(t.drillCount).toBe(0);
		expect(t.chunkData).toBeNull();
		expect(t.selectedStepId).toBeNull();
	});

	it('selectStep toggles off when same id re-selected', () => {
		const t = createLlmwikiTrace();
		t.selectStep('llmwiki:search');
		expect(t.selectedStepId).toBe('llmwiki:search');
		t.selectStep('llmwiki:search');
		expect(t.selectedStepId).toBeNull();
	});
});
