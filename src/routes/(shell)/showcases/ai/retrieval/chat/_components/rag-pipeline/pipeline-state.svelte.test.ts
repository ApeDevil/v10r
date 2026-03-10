import { describe, expect, it } from 'vitest';
import type { ChunkSummary, PipelineChunksEvent, PipelineStepEvent } from '$lib/types/pipeline';
import { createPipelineState } from './pipeline-state.svelte';

function makeChunkSummary(id: string): ChunkSummary {
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
	};
}

describe('createPipelineState', () => {
	it('initial steps all pending', () => {
		const state = createPipelineState();
		for (const step of state.steps) {
			expect(step.status).toBe('pending');
		}
	});

	describe('handleEvent', () => {
		it('updates step status', () => {
			const state = createPipelineState();
			state.handleEvent({
				type: 'pipeline:step',
				step: 'embed',
				status: 'active',
			});

			const embed = state.steps.find((s) => s.id === 'embed');
			expect(embed?.status).toBe('active');
		});

		it('updates durationMs', () => {
			const state = createPipelineState();
			state.handleEvent({
				type: 'pipeline:step',
				step: 'embed',
				status: 'done',
				durationMs: 42,
			});

			const embed = state.steps.find((s) => s.id === 'embed');
			expect(embed?.durationMs).toBe(42);
		});
	});

	describe('processAnnotations', () => {
		it('processes pipeline:step annotations', () => {
			const state = createPipelineState();
			const annotations: unknown[] = [
				{ type: 'pipeline:step', step: 'embed', status: 'active' } satisfies PipelineStepEvent,
				{ type: 'pipeline:step', step: 'embed', status: 'done', durationMs: 50 } satisfies PipelineStepEvent,
			];

			state.processAnnotations(annotations);

			const embed = state.steps.find((s) => s.id === 'embed');
			expect(embed?.status).toBe('done');
			expect(embed?.durationMs).toBe(50);
		});

		it('processes pipeline:chunks annotations', () => {
			const state = createPipelineState();
			const chunks: PipelineChunksEvent = {
				type: 'pipeline:chunks',
				tierChunks: { 'tier-1': [makeChunkSummary('c1')] },
				rankedChunks: [makeChunkSummary('c1')],
				contextChunks: [makeChunkSummary('c1')],
			};

			state.processAnnotations([chunks]);

			expect(state.chunkData).toBeTruthy();
			expect(state.chunkData?.rankedChunks).toHaveLength(1);
		});

		it('is idempotent (cursor prevents reprocessing)', () => {
			const state = createPipelineState();
			const annotations: unknown[] = [
				{ type: 'pipeline:step', step: 'embed', status: 'active' } satisfies PipelineStepEvent,
			];

			state.processAnnotations(annotations);
			state.processAnnotations(annotations); // second call — cursor at end

			const embed = state.steps.find((s) => s.id === 'embed');
			expect(embed?.status).toBe('active');
		});
	});

	describe('reset', () => {
		it('returns to initial state', () => {
			const state = createPipelineState();
			state.handleEvent({ type: 'pipeline:step', step: 'embed', status: 'done', durationMs: 100 });
			state.selectStep('embed');

			state.reset();

			expect(state.steps.every((s) => s.status === 'pending')).toBe(true);
			expect(state.selectedStepId).toBeNull();
			expect(state.chunkData).toBeNull();
		});
	});

	describe('selectStep', () => {
		it('toggles selection on', () => {
			const state = createPipelineState();
			state.selectStep('embed');
			expect(state.selectedStepId).toBe('embed');
		});

		it('toggles selection off when same step selected again', () => {
			const state = createPipelineState();
			state.selectStep('embed');
			state.selectStep('embed');
			expect(state.selectedStepId).toBeNull();
		});
	});

	describe('chunksForStep', () => {
		it('returns tier chunks', () => {
			const state = createPipelineState();
			const chunks: PipelineChunksEvent = {
				type: 'pipeline:chunks',
				tierChunks: { 'tier-1': [makeChunkSummary('c1'), makeChunkSummary('c2')] },
				rankedChunks: [makeChunkSummary('c1')],
				contextChunks: [makeChunkSummary('c1')],
			};
			state.processAnnotations([chunks]);

			expect(state.chunksForStep('tier-1')).toHaveLength(2);
		});

		it('returns ranked chunks', () => {
			const state = createPipelineState();
			const chunks: PipelineChunksEvent = {
				type: 'pipeline:chunks',
				tierChunks: {},
				rankedChunks: [makeChunkSummary('c1')],
				contextChunks: [],
			};
			state.processAnnotations([chunks]);

			expect(state.chunksForStep('rank')).toHaveLength(1);
		});

		it('returns context chunks', () => {
			const state = createPipelineState();
			const chunks: PipelineChunksEvent = {
				type: 'pipeline:chunks',
				tierChunks: {},
				rankedChunks: [],
				contextChunks: [makeChunkSummary('c1'), makeChunkSummary('c2')],
			};
			state.processAnnotations([chunks]);

			expect(state.chunksForStep('context')).toHaveLength(2);
		});

		it('returns empty when no chunkData', () => {
			const state = createPipelineState();
			expect(state.chunksForStep('tier-1')).toEqual([]);
		});
	});

	describe('isActive', () => {
		it('false when all pending', () => {
			const state = createPipelineState();
			expect(state.isActive).toBe(false);
		});

		it('true when any step is active', () => {
			const state = createPipelineState();
			state.handleEvent({ type: 'pipeline:step', step: 'embed', status: 'active' });
			expect(state.isActive).toBe(true);
		});
	});

	describe('totalDurationMs', () => {
		it('sums done steps', () => {
			const state = createPipelineState();
			state.handleEvent({ type: 'pipeline:step', step: 'embed', status: 'done', durationMs: 100 });
			state.handleEvent({ type: 'pipeline:step', step: 'tier-1', status: 'done', durationMs: 200 });

			expect(state.totalDurationMs).toBe(300);
		});

		it('returns 0 when no steps are done', () => {
			const state = createPipelineState();
			expect(state.totalDurationMs).toBe(0);
		});
	});
});
