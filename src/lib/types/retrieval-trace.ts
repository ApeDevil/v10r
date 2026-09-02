/**
 * Retrieval observability contract — the per-turn trace events the retrieval pipeline
 * emits, plus the unified client-side trace step model the rag-chat showcase renders.
 *
 * Three ORTHOGONAL axes describe a step/chunk (see docs/blueprint/ai/retrieval-observability.md):
 *   - STAGE     `RetrievalPhase`  temporal phase — the Timing waterfall lays out by this
 *   - RETRIEVER `RetrieverId`     which retriever produced it — the Paths panel groups by this
 *   - CORPUS    `RetrievalCorpus` which corpus (in $lib/types/retrieval-corpora.ts)
 */

/** Retrieval step identifiers — ordered by execution flow */
export type RetrievalStepId =
	| 'embed'
	| 'tier-1'
	| 'tier-2'
	| 'tier-3'
	| 'rank'
	| 'context'
	| 'generate'
	| 'llmwiki:overview'
	| 'llmwiki:search'
	| 'llmwiki:context'
	| 'chunks:drill'
	| 'llmwiki:verify'
	/** Coarse retriever for the chatbot branch's parallel tier-1 system-docs retrieve. */
	| 'system-docs';

export type RetrievalStepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

/** STAGE axis — the temporal phase a step belongs to. The waterfall groups bars by this. */
/** Which retrieval engine a step belongs to — the registry is filtered by this. */
export type RetrievalEngine = 'chunks' | 'llmwiki' | 'both';

export type RetrievalPhase = 'embed' | 'retrieve' | 'fuse' | 'assemble' | 'generate' | 'verify';

/** Exhaustive step → phase map. A missing key is a compile error (invalid-state-unrepresentable). */
export const PHASE_OF: Record<RetrievalStepId, RetrievalPhase> = {
	embed: 'embed',
	'tier-1': 'retrieve',
	'tier-2': 'retrieve',
	'tier-3': 'retrieve',
	rank: 'fuse',
	context: 'assemble',
	generate: 'generate',
	'llmwiki:overview': 'retrieve',
	'llmwiki:search': 'retrieve',
	'llmwiki:context': 'assemble',
	'chunks:drill': 'retrieve',
	'llmwiki:verify': 'verify',
	'system-docs': 'retrieve',
};

/**
 * Shared per-PHASE color map for retrieval trace views (waterfall bars, legend, step list).
 * Phase is the temporal axis the waterfall lays out by — coloring by phase keeps the
 * legend a true color key. Design tokens only (chart hues are theme-aware + distinct).
 * Third member of the phase-axis family beside PHASE_OF/RETRIEVER_OF, same exhaustive-Record
 * discipline. Human copy for phases (the old PHASE_GLOSS) lives in the i18n label layer.
 */
export const PHASE_COLORS: Record<RetrievalPhase, string> = {
	embed: 'var(--color-primary)',
	retrieve: 'var(--chart-3)',
	fuse: 'var(--chart-7)',
	assemble: 'var(--chart-1)',
	generate: 'var(--chart-4)',
	verify: 'var(--chart-5)',
};

/** RETRIEVER axis — which retriever produced a step's/chunk's results (tierChunks keys). */
export type RetrieverId = 'tier-1' | 'tier-2' | 'tier-3' | 'llmwiki';

/** Per-retriever provenance; distinguishes the retrievers that folded into one chunk. */
export type RetrieverKind = 'vector' | 'bm25' | 'parentChild' | 'graph' | 'llmwiki';

/** Step → retriever (only retrieve-phase steps have one). */
export const RETRIEVER_OF: Partial<Record<RetrievalStepId, RetrieverId>> = {
	'tier-1': 'tier-1',
	'tier-2': 'tier-2',
	'tier-3': 'tier-3',
	'llmwiki:overview': 'llmwiki',
	'llmwiki:search': 'llmwiki',
	'chunks:drill': 'llmwiki',
	'system-docs': 'tier-1',
};

/** Step-specific metadata (discriminated union) */
export type StepDetail =
	| EmbedDetail
	| TierDetail
	| RankDetail
	| ContextDetail
	| GenerateDetail
	| LlmwikiSearchDetail
	| LlmwikiVerifyDetail
	| DrillDetail;

export interface EmbedDetail {
	kind: 'embed';
	dimensions: number;
	/** Echoed query text (redacted in non-dev contexts) */
	query?: string;
	/** Real embedding token count, when the provider reports usage. */
	tokens?: number;
	/** True when the caller supplied a precomputed vector (no provider call was made). */
	reused?: boolean;
}

export interface TierDetail {
	kind: 'tier';
	tierNumber: 1 | 2 | 3;
	chunksFound: number;
	topSources: { title: string; score: number }[];
}

export interface RankDetail {
	kind: 'rank';
	inputChunks: number;
	outputChunks: number;
	method: 'rrf' | 'single';
}

export interface ContextDetail {
	kind: 'context';
	/** chars/4 estimate — NOT a provider count. */
	tokenEstimate: number;
	chunkCount: number;
}

export interface GenerateDetail {
	kind: 'generate';
	model?: string;
	/** Real provider usage. */
	inputTokens?: number;
	outputTokens?: number;
	/** Reasoning/thinking tokens — a SUBSET of outputTokens. */
	reasoningTokens?: number;
	/** Prompt-cache read — a SUBSET of inputTokens. */
	cachedInputTokens?: number;
}

export interface LlmwikiSearchDetail {
	kind: 'llmwiki-search';
	hits: number;
	vectorHits: number;
	bm25Hits: number;
	pointersHydrated: number;
	rrfK: number;
}

export interface LlmwikiVerifyDetail {
	kind: 'llmwiki-verify';
	total: number;
	quote: number;
	paraphrase: number;
	drifted: number;
	uncited: number;
}

export interface DrillDetail {
	kind: 'drill';
	callIndex: 0 | 1 | 2;
	idsRequested: number;
	chunksReturned: number;
}

/** Event emitted by the instrumented retrieval pipeline */
export interface RetrievalStepEvent {
	type: 'pipeline:step';
	step: RetrievalStepId;
	/** Closed STAGE discriminant — the viz groups by this, never by string-matching `step`. */
	phase: RetrievalPhase;
	/** Stable per-instance key (= step, except dynamic drills → `drill#${n}`). */
	instanceKey: string;
	/** Retriever for retrieve-phase steps; absent otherwise. */
	retriever?: RetrieverId;
	status: RetrievalStepStatus;
	/** ms from turn t0 to step start — server-authoritative, parallel-safe. Set on `active` only. */
	startOffsetMs?: number;
	durationMs?: number;
	error?: string;
	detail?: StepDetail;
	/** Correlation id for a single retrieval turn (orchestrator-stamped; absent on standalone engine runs). */
	requestId?: string;
}

/** Why a chunk survived fusion into the final context, or why it was dropped. */
export type ChunkDisposition =
	// survivors
	| 'top_k'
	| 'rrf_threshold'
	| 'graph_expansion'
	| 'parent_promoted'
	| 'pointer-only'
	| 'drilled-cited'
	| 'drilled-uncited'
	// drops
	| 'below_top_k'
	| 'rrf_cutoff';

/** Summary of a single retrieved chunk, sent to the client */
export interface ChunkSummary {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	contentPreview: string;
	contentLength: number;
	score: number;
	/** Primary (winning) retriever. */
	source: RetrieverKind;
	tier: 1 | 2 | 3 | 'llmwiki';
	survived: boolean;
	/** Per-retriever raw scores — keys are the canonical multi-source signal. */
	retrieverScores?: Partial<Record<RetrieverKind, number>>;
	/** Final RRF score contribution (hybrid fusion only) */
	rrfContribution?: number;
	/** Rank position after RRF fusion */
	rrfRank?: number;
	/** Why this chunk made it into the final context, or why it was dropped. Always populated. */
	dispositionReason?: ChunkDisposition;
}

/** Chunk data event emitted after context assembly */
export interface RetrievalChunksEvent {
	type: 'pipeline:chunks';
	tierChunks: Partial<Record<RetrieverId, ChunkSummary[]>>;
	rankedChunks: ChunkSummary[];
	contextChunks: ChunkSummary[];
	requestId?: string;
}

/** Final prompt assembled for the LLM (dev/admin receives full text; others get a hash) */
export interface RetrievalPromptEvent {
	type: 'pipeline:prompt_assembled';
	systemPrompt?: string;
	systemPromptHash?: string;
	/** System-prompt size (chars/4 estimate, incl. injected context). Ungated — a count is not a leak. */
	systemPromptTokens?: number;
	userPrompt: string;
	/** Per-block token estimates (chars/4). */
	contextBlocks: { chunkId: string; tokens: number }[];
	totalTokens: number;
	/** contextBlocks/totalTokens are chars/4 estimates, not provider counts. */
	estimated: true;
	requestId?: string;
}

/** Citation verdict for a single drilled chunk (or pointer-only page). */
export type LlmwikiCitationStatus = 'quote' | 'paraphrase' | 'drifted' | 'uncited' | 'none';

export interface LlmwikiCitationVerdict {
	pageSlug: string;
	chunkId: string | null;
	status: LlmwikiCitationStatus;
}

/** Terminal event emitted once verifyCitations resolves (post-stream). */
export interface LlmwikiCitationsEvent {
	type: 'llmwiki:citations';
	verdicts: LlmwikiCitationVerdict[];
	summary: {
		total: number;
		quote: number;
		paraphrase: number;
		drifted: number;
		uncited: number;
	};
	requestId?: string;
}

/** Unified per-step UI state (chunks + llmwiki). The waterfall + step list render these. */
export interface RetrievalTraceStep {
	id: RetrievalStepId;
	/** Stable list key — `id`, except dynamic drills → `drill#${ordinal}`. */
	instanceKey: string;
	label: string;
	phase: RetrievalPhase;
	retriever?: RetrieverId;
	engine: RetrievalEngine;
	status: RetrievalStepStatus;
	/** ms from turn t0 to step start; drives waterfall bar position. */
	startOffsetMs?: number;
	durationMs?: number;
	error?: string;
	detail?: StepDetail;
}

/** Static descriptor for a retrieval step (label/phase/retriever/engine), the trace seed. */
export interface RetrievalStepDescriptor {
	id: RetrievalStepId;
	label: string;
	phase: RetrievalPhase;
	engine: RetrievalEngine;
	retriever?: RetrieverId;
	/** Appended dynamically per occurrence (drill); not seeded as pending. */
	dynamic?: boolean;
}

/** Single registry replacing PIPELINE_STEPS + LLMWIKI_STEPS. Filtered by `engine`. */
export const RETRIEVAL_STEPS: RetrievalStepDescriptor[] = [
	{ id: 'embed', label: 'Embed', phase: 'embed', engine: 'chunks' },
	{ id: 'tier-1', label: 'Vector', phase: 'retrieve', engine: 'chunks', retriever: 'tier-1' },
	{ id: 'tier-2', label: 'Small-to-Big', phase: 'retrieve', engine: 'chunks', retriever: 'tier-2' },
	{ id: 'tier-3', label: 'Entity Graph', phase: 'retrieve', engine: 'chunks', retriever: 'tier-3' },
	{ id: 'rank', label: 'Rank', phase: 'fuse', engine: 'chunks' },
	{ id: 'context', label: 'Context', phase: 'assemble', engine: 'chunks' },
	{ id: 'llmwiki:overview', label: 'Overview', phase: 'retrieve', engine: 'llmwiki', retriever: 'llmwiki' },
	{ id: 'llmwiki:search', label: 'Wiki Search', phase: 'retrieve', engine: 'llmwiki', retriever: 'llmwiki' },
	{ id: 'system-docs', label: 'System Docs', phase: 'retrieve', engine: 'llmwiki', retriever: 'tier-1' },
	{ id: 'llmwiki:context', label: 'Context', phase: 'assemble', engine: 'llmwiki' },
	{ id: 'generate', label: 'Generate', phase: 'generate', engine: 'both' },
	{ id: 'chunks:drill', label: 'Drill', phase: 'retrieve', engine: 'llmwiki', retriever: 'llmwiki', dynamic: true },
	{ id: 'llmwiki:verify', label: 'Verify', phase: 'verify', engine: 'llmwiki' },
];

/** Honest token-breakdown panel model (derived in the trace state, not a wire type). */
export interface TokenBreakdown {
	/** Real provider usage (generate). */
	inputTokensReal?: number;
	outputTokensReal?: number;
	reasoningTokensReal?: number;
	cachedInputTokensReal?: number;
	embedTokensReal?: number;
	/** System-prompt size — chars/4 estimate (incl. injected context), NOT a provider count. */
	systemPromptTokensEst?: number;
	/** chars/4 estimate. */
	contextTokensEst: number;
	/** systemPromptTokensEst − contextTokensEst (context lives inside the system prompt). */
	baseSystemApprox?: number;
	/** inputTokensReal − systemPromptTokensEst (≈ user + history + tool scaffold). */
	promptOverheadApprox?: number;
	/** Forces the UI to badge context as an estimate. */
	contextIsEstimate: true;
}
