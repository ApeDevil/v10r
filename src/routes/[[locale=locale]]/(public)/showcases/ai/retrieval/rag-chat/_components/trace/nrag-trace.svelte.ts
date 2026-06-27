/**
 * Unified nRAG trace state — one factory for BOTH the rawrag (3-tier) and llmwiki paths,
 * replacing the former divergent createRawragTrace + createLlmwikiTrace. Seeded from the
 * single PIPELINE_REGISTRY filtered by `path`; dynamic drill steps are appended per event.
 *
 * Key correctness properties (see docs/blueprint/ai/nrag-observability.md):
 *  - captures `startOffsetMs` (server, turn-t0-relative) so the waterfall shows true overlap
 *  - `totalDurationMs` = wall-clock SPAN (max end − min start), never a sum of parallel bars
 *  - `error` is terminal; `finalizeActive()` flips a stuck `active` step on stream death
 *  - `instanceKey` gives drills stable keys (drill#0..2) — avoids each_key_duplicate
 */
import {
	type ChunkSummary,
	type LlmwikiCitationsEvent,
	type LlmwikiCitationVerdict,
	type NragTraceStep,
	PIPELINE_REGISTRY,
	type PipelineChunksEvent,
	type PipelinePromptEvent,
	type PipelineStepEvent,
	type RetrieverLane,
	type TokenBreakdown,
} from '$lib/types/pipeline';

export type NragTracePath = 'rawrag' | 'llmwiki';

function seed(path: NragTracePath): NragTraceStep[] {
	return PIPELINE_REGISTRY.filter((d) => !d.dynamic && (d.path === path || d.path === 'both')).map((d) => ({
		id: d.id,
		instanceKey: d.id,
		label: d.label,
		phase: d.phase,
		lane: d.lane,
		path: d.path,
		status: 'pending' as const,
	}));
}

export type NragTraceState = ReturnType<typeof createNragTrace>;

export function createNragTrace(path: NragTracePath) {
	let steps = $state<NragTraceStep[]>(seed(path));
	let selectedStepId = $state<string | null>(null);
	let chunkData = $state<PipelineChunksEvent | null>(null);
	let assembledPrompt = $state<PipelinePromptEvent | null>(null);
	let citations = $state<LlmwikiCitationsEvent | null>(null);

	// Non-reactive turn anchor: only read/written inside applyAnnotations, never exposed by a
	// getter — so it can't drive effects. It only distinguishes a new turn (clear selection)
	// from a re-applied REPLACE frame for the same message (preserve selection).
	let currentMessageId: string | null = null;

	// Pure reducer — same semantics as the former handleStep, but operating on a passed array so
	// a full REPLACE frame can be replayed from seed each call (idempotent).
	function reduceStep(arr: NragTraceStep[], event: PipelineStepEvent): NragTraceStep[] {
		const key = event.instanceKey || event.step;
		const idx = arr.findIndex((s) => s.instanceKey === key);

		if (idx === -1) {
			// Dynamic step (drill) — not seeded; append in arrival (temporal) order.
			const ordinal = arr.filter((s) => s.id === event.step).length;
			const descriptor = PIPELINE_REGISTRY.find((d) => d.id === event.step);
			return [
				...arr,
				{
					id: event.step,
					instanceKey: key,
					label: event.step === 'rawrag:drill' ? `Drill #${ordinal + 1}` : (descriptor?.label ?? event.step),
					phase: event.phase,
					lane: event.lane,
					path,
					status: event.status,
					startOffsetMs: event.startOffsetMs,
					durationMs: event.durationMs,
					error: event.error,
					detail: event.detail,
				},
			];
		}

		return arr.map((s, i) => {
			if (i !== idx) return s;
			// 'error' is terminal — a late 'done' must not resurrect a failed step.
			if (s.status === 'error' && event.status !== 'error') {
				return { ...s, durationMs: event.durationMs ?? s.durationMs, detail: event.detail ?? s.detail };
			}
			return {
				...s,
				status: event.status,
				// startOffsetMs is stamped on the `active` emit; preserve it across done/error.
				startOffsetMs: event.startOffsetMs ?? s.startOffsetMs,
				durationMs: event.durationMs ?? s.durationMs,
				error: event.error ?? s.error,
				detail: event.detail ?? s.detail,
			};
		});
	}

	/**
	 * REPLACE-correct, idempotent, turn-anchored feed. Each metadata frame carries the FULL event
	 * array, so we rebuild from seed and replay all of it. A new message id is a new turn (clear
	 * selection); the same id re-applies, preserving the user's selection.
	 */
	function applyAnnotations(messageId: string, full: readonly unknown[]) {
		const isNewTurn = messageId !== currentMessageId;
		currentMessageId = messageId;

		let nextSteps = seed(path);
		let nextChunk: PipelineChunksEvent | null = null;
		let nextPrompt: PipelinePromptEvent | null = null;
		let nextCitations: LlmwikiCitationsEvent | null = null;

		for (const raw of full) {
			const ann = raw as Record<string, unknown> | null;
			if (!ann) continue;
			if (ann.type === 'pipeline:step') nextSteps = reduceStep(nextSteps, ann as unknown as PipelineStepEvent);
			else if (ann.type === 'pipeline:chunks') nextChunk = ann as unknown as PipelineChunksEvent;
			else if (ann.type === 'pipeline:prompt_assembled') nextPrompt = ann as unknown as PipelinePromptEvent;
			else if (ann.type === 'llmwiki:citations') nextCitations = ann as unknown as LlmwikiCitationsEvent;
		}

		// One assignment per $state field per frame.
		steps = nextSteps;
		chunkData = nextChunk;
		assembledPrompt = nextPrompt;
		citations = nextCitations;
		if (isNewTurn) selectedStepId = null;
	}

	function reset() {
		steps = seed(path);
		selectedStepId = null;
		chunkData = null;
		assembledPrompt = null;
		citations = null;
		currentMessageId = null;
	}

	/** Backstop: flip any lingering `active` step to `error` when the stream dies without a terminal. */
	function finalizeActive() {
		if (!steps.some((s) => s.status === 'active')) return;
		steps = steps.map((s) => (s.status === 'active' ? { ...s, status: 'error', error: s.error ?? 'interrupted' } : s));
	}

	function selectStep(id: string | null) {
		selectedStepId = selectedStepId === id ? null : id;
	}

	function chunksForStep(stepId: string): ChunkSummary[] {
		if (!chunkData) return [];
		if (stepId.startsWith('tier-')) return chunkData.tierChunks[stepId as RetrieverLane] ?? [];
		if (stepId === 'system-docs') return chunkData.tierChunks['tier-1'] ?? [];
		if (stepId === 'rank') return chunkData.rankedChunks;
		if (stepId === 'context' || stepId === 'llmwiki:context') return chunkData.contextChunks;
		if (stepId === 'llmwiki:search' || stepId === 'llmwiki:overview') return chunkData.tierChunks.llmwiki ?? [];
		if (stepId === 'rawrag:drill' || stepId.startsWith('drill#')) return chunkData.contextChunks;
		return [];
	}

	function verdictForChunk(chunkId: string): LlmwikiCitationVerdict | null {
		if (!citations) return null;
		return citations.verdicts.find((v) => v.chunkId === chunkId) ?? null;
	}

	return {
		path,
		get steps() {
			return steps;
		},
		get selectedStepId() {
			return selectedStepId;
		},
		get selectedStep() {
			if (!selectedStepId) return null;
			return steps.find((s) => s.instanceKey === selectedStepId) ?? null;
		},
		get isActive() {
			return steps.some((s) => s.status === 'active');
		},
		/** Wall-clock span — handles parallel bars correctly (NOT a sum of durations). */
		get totalDurationMs() {
			const live = steps.filter((s) => s.startOffsetMs != null && s.durationMs != null);
			if (live.length === 0) return 0;
			const start = Math.min(...live.map((s) => s.startOffsetMs ?? 0));
			const end = Math.max(...live.map((s) => (s.startOffsetMs ?? 0) + (s.durationMs ?? 0)));
			return Math.max(0, Math.round(end - start));
		},
		get chunkData() {
			return chunkData;
		},
		get chunkCounts(): Record<string, number> {
			if (!chunkData) return {};
			const counts: Record<string, number> = {};
			for (const [k, chunks] of Object.entries(chunkData.tierChunks)) counts[k] = chunks?.length ?? 0;
			counts.rank = chunkData.rankedChunks.length;
			counts.context = chunkData.contextChunks.length;
			return counts;
		},
		get assembledPrompt() {
			return assembledPrompt;
		},
		get citations() {
			return citations;
		},
		// llmwiki-shaped views
		get pages(): ChunkSummary[] {
			return chunkData?.tierChunks.llmwiki ?? [];
		},
		get drilledChunks(): ChunkSummary[] {
			return chunkData?.contextChunks ?? [];
		},
		get drillSteps(): NragTraceStep[] {
			return steps.filter((s) => s.id === 'rawrag:drill');
		},
		get drillCount() {
			return steps.filter((s) => s.id === 'rawrag:drill').length;
		},
		get summaryLabel(): string {
			if (path === 'llmwiki') {
				const pages = chunkData?.tierChunks.llmwiki?.length ?? 0;
				const drills = steps.filter((s) => s.id === 'rawrag:drill').length;
				if (pages === 0 && drills === 0) return '';
				const pagePart = `${pages} page${pages === 1 ? '' : 's'}`;
				return drills === 0 ? pagePart : `${pagePart} · ${drills} drill${drills === 1 ? '' : 's'}`;
			}
			const ctx = chunkData?.contextChunks.length ?? 0;
			return ctx === 0 ? '' : `${ctx} chunk${ctx === 1 ? '' : 's'} used`;
		},
		/** Honest token breakdown (real provider counts vs chars/4 estimates). */
		get tokenBreakdown(): TokenBreakdown | null {
			const gen = steps.find((s) => s.id === 'generate');
			const genDetail = gen?.detail?.kind === 'generate' ? gen.detail : null;
			const embed = steps.find((s) => s.id === 'embed');
			const embedDetail = embed?.detail?.kind === 'embed' ? embed.detail : null;
			if (!genDetail && !assembledPrompt) return null;
			const contextTokensEst = assembledPrompt?.totalTokens ?? 0;
			const systemPromptTokensEst = assembledPrompt?.systemPromptTokens;
			const inputTokensReal = genDetail?.inputTokens;
			return {
				inputTokensReal,
				outputTokensReal: genDetail?.outputTokens,
				reasoningTokensReal: genDetail?.reasoningTokens,
				cachedInputTokensReal: genDetail?.cachedInputTokens,
				embedTokensReal: embedDetail?.tokens,
				systemPromptTokensEst,
				contextTokensEst,
				baseSystemApprox:
					systemPromptTokensEst != null ? Math.max(0, systemPromptTokensEst - contextTokensEst) : undefined,
				promptOverheadApprox:
					inputTokensReal != null && systemPromptTokensEst != null
						? Math.max(0, inputTokensReal - systemPromptTokensEst)
						: undefined,
				contextIsEstimate: true,
			};
		},
		applyAnnotations,
		reset,
		finalizeActive,
		selectStep,
		chunksForStep,
		verdictForChunk,
	};
}
