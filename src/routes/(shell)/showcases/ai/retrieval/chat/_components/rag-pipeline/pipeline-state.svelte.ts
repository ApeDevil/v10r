import {
	type ChunkSummary,
	PIPELINE_STEPS,
	type PipelineChunksEvent,
	type PipelineStepEvent,
	type PipelineStepId,
	type PipelineStepState,
} from '$lib/types/pipeline';

function createInitialSteps(): PipelineStepState[] {
	return PIPELINE_STEPS.map((s) => ({
		id: s.id,
		label: s.label,
		status: 'pending',
	}));
}

export type PipelineState = ReturnType<typeof createPipelineState>;

export function createPipelineState() {
	let steps = $state<PipelineStepState[]>(createInitialSteps());
	let selectedStepId = $state<PipelineStepId | null>(null);
	let annotationCursor = $state(0);
	let chunkData = $state<PipelineChunksEvent | null>(null);

	function handleEvent(event: PipelineStepEvent) {
		steps = steps.map((s) => {
			if (s.id !== event.step) return s;
			return {
				...s,
				status: event.status,
				durationMs: event.durationMs ?? s.durationMs,
				error: event.error ?? s.error,
				detail: event.detail ?? s.detail,
			};
		});
	}

	function processAnnotations(annotations: unknown[]) {
		if (!annotations || annotationCursor >= annotations.length) return;

		for (let i = annotationCursor; i < annotations.length; i++) {
			const ann = annotations[i] as Record<string, unknown>;
			if (ann && ann.type === 'pipeline:step') {
				handleEvent(ann as unknown as PipelineStepEvent);
			} else if (ann && ann.type === 'pipeline:chunks') {
				chunkData = ann as unknown as PipelineChunksEvent;
			}
		}
		annotationCursor = annotations.length;
	}

	function reset() {
		steps = createInitialSteps();
		selectedStepId = null;
		chunkData = null;
	}

	function resetCursor() {
		annotationCursor = 0;
	}

	function selectStep(id: PipelineStepId | null) {
		selectedStepId = selectedStepId === id ? null : id;
	}

	function chunksForStep(stepId: PipelineStepId): ChunkSummary[] {
		if (!chunkData) return [];
		if (stepId.startsWith('tier-')) return chunkData.tierChunks[stepId] ?? [];
		if (stepId === 'rank') return chunkData.rankedChunks;
		if (stepId === 'context') return chunkData.contextChunks;
		return [];
	}

	return {
		get steps() {
			return steps;
		},
		get selectedStepId() {
			return selectedStepId;
		},
		get selectedStep() {
			if (!selectedStepId) return null;
			return steps.find((s) => s.id === selectedStepId) ?? null;
		},
		get isActive() {
			return steps.some((s) => s.status === 'active');
		},
		get totalDurationMs() {
			const doneSteps = steps.filter((s) => s.status === 'done' && s.durationMs);
			if (doneSteps.length === 0) return 0;
			return doneSteps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
		},
		get chunkData() {
			return chunkData;
		},
		get chunkCounts(): Record<string, number> {
			if (!chunkData) return {};
			const counts: Record<string, number> = {};
			for (const [key, chunks] of Object.entries(chunkData.tierChunks)) {
				counts[key] = chunks.length;
			}
			counts.rank = chunkData.rankedChunks.length;
			counts.context = chunkData.contextChunks.length;
			return counts;
		},
		handleEvent,
		processAnnotations,
		reset,
		resetCursor,
		selectStep,
		chunksForStep,
	};
}
