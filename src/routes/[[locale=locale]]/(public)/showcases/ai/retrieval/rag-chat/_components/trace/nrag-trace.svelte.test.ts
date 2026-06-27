import { describe, expect, it } from 'vitest';
import type {
	ChunkDisposition,
	ChunkSummary,
	LlmwikiCitationsEvent,
	PipelineChunksEvent,
	PipelinePromptEvent,
	PipelineStepEvent,
	PipelineStepId,
	PipelineStepStatus,
} from '$lib/types/pipeline';
import { PHASE_OF } from '$lib/types/pipeline';
import { createNragTrace } from './nrag-trace.svelte';

/** Build a fully-populated step event (phase + instanceKey are now required on the wire). */
function step(
	id: PipelineStepId,
	status: PipelineStepStatus,
	extra: Partial<PipelineStepEvent> = {},
): PipelineStepEvent {
	return {
		type: 'pipeline:step',
		step: id,
		phase: PHASE_OF[id],
		instanceKey: id,
		status,
		...extra,
	};
}

function drill(
	instanceKey: string,
	status: PipelineStepStatus,
	extra: Partial<PipelineStepEvent> = {},
): PipelineStepEvent {
	return {
		type: 'pipeline:step',
		step: 'rawrag:drill',
		phase: PHASE_OF['rawrag:drill'],
		instanceKey,
		status,
		...extra,
	};
}

function chunk(id: string, partial: Partial<ChunkSummary> = {}): ChunkSummary {
	return {
		chunkId: id,
		documentId: `doc-${id}`,
		documentTitle: `Doc ${id}`,
		contentPreview: `Preview ${id}`,
		contentLength: 100,
		score: 0.9,
		source: 'vector',
		tier: 1,
		survived: true,
		...partial,
	};
}

describe('createNragTrace (rawrag)', () => {
	it('seeds the rawrag steps as pending (no llmwiki-only steps)', () => {
		const t = createNragTrace('rawrag');
		expect(t.steps.length).toBeGreaterThan(0);
		expect(t.steps.every((s) => s.status === 'pending')).toBe(true);
		expect(t.steps.some((s) => s.id === 'embed')).toBe(true);
		expect(t.steps.some((s) => s.id === 'llmwiki:verify')).toBe(false);
	});

	it('applyAnnotations updates step status + duration + startOffset', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [
			step('embed', 'active', { startOffsetMs: 0 }),
			step('embed', 'done', { durationMs: 42 }),
		]);
		const embed = t.steps.find((s) => s.id === 'embed');
		expect(embed?.status).toBe('done');
		expect(embed?.durationMs).toBe(42);
		expect(embed?.startOffsetMs).toBe(0);
	});

	it('error is terminal — a late done does not resurrect a failed step', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [
			step('generate', 'active', { startOffsetMs: 10 }),
			step('generate', 'error', { error: 'timeout' }),
			step('generate', 'done', { durationMs: 5 }),
		]);
		const gen = t.steps.find((s) => s.id === 'generate');
		expect(gen?.status).toBe('error');
		expect(gen?.error).toBe('timeout');
	});

	it('totalDurationMs is the wall-clock SPAN of parallel bars, never their sum', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [
			step('embed', 'done', { startOffsetMs: 0, durationMs: 5 }),
			step('tier-1', 'done', { startOffsetMs: 5, durationMs: 100 }),
			step('tier-2', 'done', { startOffsetMs: 6, durationMs: 100 }),
		]);
		// sum would be 205; span = max(end=106) - min(start=0) = 106
		expect(t.totalDurationMs).toBe(106);
	});

	it('finalizeActive flips a lingering active step to error', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [step('embed', 'active', { startOffsetMs: 0 })]);
		expect(t.isActive).toBe(true);
		t.finalizeActive();
		const embed = t.steps.find((s) => s.id === 'embed');
		expect(embed?.status).toBe('error');
		expect(embed?.error).toBe('interrupted');
		expect(t.isActive).toBe(false);
	});

	it('chunksForStep resolves tier / rank / context lanes', () => {
		const t = createNragTrace('rawrag');
		const chunks: PipelineChunksEvent = {
			type: 'pipeline:chunks',
			tierChunks: { 'tier-1': [chunk('a'), chunk('b')] },
			rankedChunks: [chunk('a')],
			contextChunks: [chunk('a'), chunk('b'), chunk('c')],
		};
		t.applyAnnotations('m1', [chunks]);
		expect(t.chunksForStep('tier-1')).toHaveLength(2);
		expect(t.chunksForStep('rank')).toHaveLength(1);
		expect(t.chunksForStep('context')).toHaveLength(3);
		expect(t.chunkCounts['tier-1']).toBe(2);
	});

	it('prompt_assembled carries the estimated marker', () => {
		const t = createNragTrace('rawrag');
		const prompt: PipelinePromptEvent = {
			type: 'pipeline:prompt_assembled',
			systemPrompt: 'sys',
			systemPromptTokens: 1200,
			userPrompt: 'u',
			contextBlocks: [{ chunkId: 'a', tokens: 50 }],
			totalTokens: 320,
			estimated: true,
		};
		t.applyAnnotations('m1', [prompt]);
		expect(t.assembledPrompt?.estimated).toBe(true);
		expect(t.assembledPrompt?.totalTokens).toBe(320);
	});

	it('tokenBreakdown separates real provider counts from chars/4 estimates', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [
			step('generate', 'done', {
				durationMs: 100,
				detail: { kind: 'generate', inputTokens: 2000, outputTokens: 300, reasoningTokens: 80 },
			}),
			{
				type: 'pipeline:prompt_assembled',
				userPrompt: 'u',
				systemPromptTokens: 1500,
				contextBlocks: [],
				totalTokens: 400,
				estimated: true,
			} satisfies PipelinePromptEvent,
		]);
		const tb = t.tokenBreakdown;
		expect(tb?.inputTokensReal).toBe(2000);
		expect(tb?.outputTokensReal).toBe(300);
		expect(tb?.reasoningTokensReal).toBe(80);
		expect(tb?.contextTokensEst).toBe(400);
		expect(tb?.contextIsEstimate).toBe(true);
		// baseSystem = systemPrompt(1500) - context(400); overhead = input(2000) - systemPrompt(1500)
		expect(tb?.baseSystemApprox).toBe(1100);
		expect(tb?.promptOverheadApprox).toBe(500);
	});

	it('selectStep toggles selection by instanceKey', () => {
		const t = createNragTrace('rawrag');
		t.selectStep('embed');
		expect(t.selectedStepId).toBe('embed');
		expect(t.selectedStep?.id).toBe('embed');
		t.selectStep('embed');
		expect(t.selectedStepId).toBeNull();
	});

	it('summaryLabel reports context chunks used', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [
			{
				type: 'pipeline:chunks',
				tierChunks: {},
				rankedChunks: [],
				contextChunks: [chunk('a'), chunk('b')],
			} satisfies PipelineChunksEvent,
		]);
		expect(t.summaryLabel).toBe('2 chunks used');
	});

	it('reset returns to the seeded pending state', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [step('embed', 'done', { durationMs: 10 })]);
		t.selectStep('embed');
		t.reset();
		expect(t.steps.every((s) => s.status === 'pending')).toBe(true);
		expect(t.selectedStepId).toBeNull();
		expect(t.chunkData).toBeNull();
	});

	it('applyAnnotations is idempotent for the same message id (REPLACE rebuild)', () => {
		const t = createNragTrace('rawrag');
		const anns = [step('embed', 'active', { startOffsetMs: 0 })];
		t.applyAnnotations('m1', anns);
		t.applyAnnotations('m1', anns);
		expect(t.steps.find((s) => s.id === 'embed')?.status).toBe('active');
	});

	it('a new message id clears the prior turn (selection + steps rebuilt from seed)', () => {
		const t = createNragTrace('rawrag');
		t.applyAnnotations('m1', [step('embed', 'done', { durationMs: 10 })]);
		t.selectStep('embed');
		expect(t.selectedStepId).toBe('embed');
		// New turn (different id) with an empty array → back to pending + selection cleared.
		t.applyAnnotations('m2', []);
		expect(t.steps.every((s) => s.status === 'pending')).toBe(true);
		expect(t.selectedStepId).toBeNull();
	});
});

describe('createNragTrace (llmwiki)', () => {
	it('seeds the llmwiki + shared steps (no rawrag tiers)', () => {
		const t = createNragTrace('llmwiki');
		expect(t.steps.some((s) => s.id === 'llmwiki:overview')).toBe(true);
		expect(t.steps.some((s) => s.id === 'generate')).toBe(true);
		expect(t.steps.some((s) => s.id === 'tier-2')).toBe(false);
	});

	it('appends dynamic drill steps and dedups by instanceKey', () => {
		const t = createNragTrace('llmwiki');
		t.applyAnnotations('m1', [
			drill('drill#0', 'active', { startOffsetMs: 200 }),
			drill('drill#0', 'done', {
				startOffsetMs: 200,
				durationMs: 40,
				detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 },
			}),
			drill('drill#1', 'done', {
				startOffsetMs: 260,
				durationMs: 30,
				detail: { kind: 'drill', callIndex: 1, idsRequested: 2, chunksReturned: 2 },
			}),
		]);
		// drill#0 active→done collapses to ONE step; drill#1 is a second
		expect(t.drillCount).toBe(2);
		expect(t.drillSteps.map((s) => s.instanceKey)).toEqual(['drill#0', 'drill#1']);
		expect(t.drillSteps[0].status).toBe('done');
		expect(t.drillSteps[0].label).toBe('Drill #1');
	});

	it('reprocessing the same drill array does not duplicate steps', () => {
		const t = createNragTrace('llmwiki');
		const anns = [
			drill('drill#0', 'done', {
				startOffsetMs: 100,
				durationMs: 10,
				detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 },
			}),
		];
		t.applyAnnotations('m1', anns);
		t.applyAnnotations('m1', anns);
		expect(t.drillCount).toBe(1);
	});

	it('exposes pages, drilled chunks (with disposition) and citation verdicts', () => {
		const t = createNragTrace('llmwiki');
		const disposition: ChunkDisposition = 'drilled-cited';
		t.applyAnnotations('m1', [
			{
				type: 'pipeline:chunks',
				tierChunks: {
					llmwiki: [
						chunk('p1', { source: 'llmwiki', tier: 'llmwiki' }),
						chunk('p2', { source: 'llmwiki', tier: 'llmwiki' }),
					],
				},
				rankedChunks: [],
				contextChunks: [chunk('c1', { dispositionReason: disposition })],
			} satisfies PipelineChunksEvent,
			{
				type: 'llmwiki:citations',
				verdicts: [
					{ pageSlug: 'p1', chunkId: 'c1', status: 'quote' },
					{ pageSlug: 'p2', chunkId: null, status: 'none' },
				],
				summary: { total: 2, quote: 1, paraphrase: 0, drifted: 0, uncited: 0 },
			} satisfies LlmwikiCitationsEvent,
		]);
		expect(t.pages).toHaveLength(2);
		expect(t.drilledChunks[0].dispositionReason).toBe('drilled-cited');
		expect(t.verdictForChunk('c1')?.status).toBe('quote');
		expect(t.verdictForChunk('nope')).toBeNull();
	});

	it('summaryLabel formats pages + drills', () => {
		const t = createNragTrace('llmwiki');
		t.applyAnnotations('m1', [
			{
				type: 'pipeline:chunks',
				tierChunks: {
					llmwiki: [
						chunk('p1', { source: 'llmwiki', tier: 'llmwiki' }),
						chunk('p2', { source: 'llmwiki', tier: 'llmwiki' }),
						chunk('p3', { source: 'llmwiki', tier: 'llmwiki' }),
					],
				},
				rankedChunks: [],
				contextChunks: [],
			} satisfies PipelineChunksEvent,
			drill('drill#0', 'done', {
				startOffsetMs: 100,
				durationMs: 10,
				detail: { kind: 'drill', callIndex: 0, idsRequested: 1, chunksReturned: 1 },
			}),
		]);
		expect(t.summaryLabel).toBe('3 pages · 1 drill');
	});
});
