import {
	type ChunkSummary,
	LLMWIKI_STEPS,
	type LlmwikiCitationVerdict,
	type LlmwikiCitationsEvent,
	type PipelineChunksEvent,
	type PipelinePromptEvent,
	type PipelineStepEvent,
	type PipelineStepId,
	type PipelineStepState,
} from '$lib/types/pipeline';

/**
 * Dynamic drill step.
 * `rawrag:drill` events are emitted per tool call (0..3 per turn) via `onStepFinish`.
 * We append a step per event instead of pre-allocating a "skipped" node — absence
 * is the honest signal when the model correctly stays at TLDR level.
 */
type DrillStep = PipelineStepState & { drillOrdinal: number };

function createInitialSteps(): PipelineStepState[] {
	return LLMWIKI_STEPS.map((s) => ({
		id: s.id,
		label: s.label,
		status: 'pending',
	}));
}

export type LlmwikiTraceState = ReturnType<typeof createLlmwikiTrace>;

export function createLlmwikiTrace() {
	let baseSteps = $state<PipelineStepState[]>(createInitialSteps());
	let drillSteps = $state<DrillStep[]>([]);
	let selectedStepId = $state<string | null>(null);
	let annotationCursor = $state(0);
	let chunkData = $state<PipelineChunksEvent | null>(null);
	let assembledPrompt = $state<PipelinePromptEvent | null>(null);
	let citations = $state<LlmwikiCitationsEvent | null>(null);

	function handleStep(event: PipelineStepEvent) {
		if (event.step === 'rawrag:drill') {
			const ordinal = drillSteps.length;
			const newStep: DrillStep = {
				id: 'rawrag:drill',
				label: `Drill #${ordinal + 1}`,
				status: event.status,
				durationMs: event.durationMs,
				error: event.error,
				detail: event.detail,
				drillOrdinal: ordinal,
			};
			drillSteps = [...drillSteps, newStep];
			return;
		}
		baseSteps = baseSteps.map((s) => {
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
			if (!ann) continue;
			if (ann.type === 'pipeline:step') {
				handleStep(ann as unknown as PipelineStepEvent);
			} else if (ann.type === 'pipeline:chunks') {
				chunkData = ann as unknown as PipelineChunksEvent;
			} else if (ann.type === 'pipeline:prompt_assembled') {
				assembledPrompt = ann as unknown as PipelinePromptEvent;
			} else if (ann.type === 'llmwiki:citations') {
				citations = ann as unknown as LlmwikiCitationsEvent;
			}
		}
		annotationCursor = annotations.length;
	}

	function reset() {
		baseSteps = createInitialSteps();
		drillSteps = [];
		selectedStepId = null;
		chunkData = null;
		assembledPrompt = null;
		citations = null;
	}

	function resetCursor() {
		annotationCursor = 0;
	}

	function selectStep(id: string | null) {
		selectedStepId = selectedStepId === id ? null : id;
	}

	function chunksForStep(stepId: PipelineStepId): ChunkSummary[] {
		if (!chunkData) return [];
		if (stepId === 'llmwiki:search') return chunkData.tierChunks.llmwiki ?? [];
		if (stepId === 'rawrag:drill') return chunkData.contextChunks;
		return [];
	}

	function verdictForChunk(chunkId: string): LlmwikiCitationVerdict | null {
		if (!citations) return null;
		return citations.verdicts.find((v) => v.chunkId === chunkId) ?? null;
	}

	return {
		get steps(): PipelineStepState[] {
			const generateIdx = baseSteps.findIndex((s) => s.id === 'generate');
			if (generateIdx === -1 || drillSteps.length === 0) return baseSteps;
			return [
				...baseSteps.slice(0, generateIdx + 1),
				...drillSteps,
				...baseSteps.slice(generateIdx + 1),
			];
		},
		get baseSteps() {
			return baseSteps;
		},
		get drillSteps() {
			return drillSteps;
		},
		get drillCount() {
			return drillSteps.length;
		},
		get selectedStepId() {
			return selectedStepId;
		},
		get isActive() {
			return baseSteps.some((s) => s.status === 'active') || drillSteps.some((s) => s.status === 'active');
		},
		get totalDurationMs() {
			const base = baseSteps.filter((s) => s.status === 'done' && s.durationMs).reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
			const drill = drillSteps.filter((s) => s.status === 'done' && s.durationMs).reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
			return base + drill;
		},
		get chunkData() {
			return chunkData;
		},
		get assembledPrompt() {
			return assembledPrompt;
		},
		get citations() {
			return citations;
		},
		get pages(): ChunkSummary[] {
			return chunkData?.tierChunks.llmwiki ?? [];
		},
		get drilledChunks(): ChunkSummary[] {
			return chunkData?.contextChunks ?? [];
		},
		get summaryLabel(): string {
			const pages = chunkData?.tierChunks.llmwiki?.length ?? 0;
			const drills = drillSteps.length;
			if (pages === 0 && drills === 0) return '';
			const pagePart = `${pages} page${pages === 1 ? '' : 's'}`;
			if (drills === 0) return pagePart;
			return `${pagePart} · ${drills} drill${drills === 1 ? '' : 's'}`;
		},
		processAnnotations,
		reset,
		resetCursor,
		selectStep,
		chunksForStep,
		verdictForChunk,
	};
}
