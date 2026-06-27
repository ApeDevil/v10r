/**
 * nRAG observability contract — the per-turn trace events the retrieval pipeline
 * emits, plus the unified client-side trace step model the rag-chat showcase renders.
 *
 * Three ORTHOGONAL axes describe a step/chunk (see docs/blueprint/ai/nrag-observability.md):
 *   - STAGE  `NragPhase`     temporal phase — the Timing waterfall lays out by this
 *   - LANE   `RetrieverLane` which retriever produced it — the Paths panel groups by this
 *   - STORE  `NragLayer`     which corpus (in $lib/types/nrag.ts)
 */

/** Pipeline step identifiers — ordered by execution flow */
export type PipelineStepId =
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
	| 'rawrag:drill'
	| 'llmwiki:verify'
	/** Coarse lane for the chatbot branch's parallel tier-1 system-docs retrieve. */
	| 'system-docs';

export type PipelineStepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

/** STAGE axis — the temporal phase a step belongs to. The waterfall groups bars by this. */
export type NragPhase = 'embed' | 'retrieve' | 'fuse' | 'assemble' | 'generate' | 'verify';

/** Exhaustive step → phase map. A missing key is a compile error (invalid-state-unrepresentable). */
export const PHASE_OF: Record<PipelineStepId, NragPhase> = {
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
	'rawrag:drill': 'retrieve',
	'llmwiki:verify': 'verify',
	'system-docs': 'retrieve',
};

/** LANE axis — which retriever produced a step's/chunk's results (tierChunks keys). */
export type RetrieverLane = 'tier-1' | 'tier-2' | 'tier-3' | 'llmwiki';

/** Per-retriever provenance; distinguishes the retrievers that folded into one chunk. */
export type RetrieverKind = 'vector' | 'bm25' | 'parentChild' | 'graph' | 'llmwiki';

/** Step → retriever lane (only retrieve-phase steps have a lane). */
export const LANE_OF: Partial<Record<PipelineStepId, RetrieverLane>> = {
	'tier-1': 'tier-1',
	'tier-2': 'tier-2',
	'tier-3': 'tier-3',
	'llmwiki:overview': 'llmwiki',
	'llmwiki:search': 'llmwiki',
	'rawrag:drill': 'llmwiki',
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
export interface PipelineStepEvent {
	type: 'pipeline:step';
	step: PipelineStepId;
	/** Closed STAGE discriminant — the viz groups by this, never by string-matching `step`. */
	phase: NragPhase;
	/** Stable per-instance key (= step, except dynamic drills → `drill#${n}`). */
	instanceKey: string;
	/** Retriever lane for retrieve-phase steps; absent otherwise. */
	lane?: RetrieverLane;
	status: PipelineStepStatus;
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
export interface PipelineChunksEvent {
	type: 'pipeline:chunks';
	tierChunks: Partial<Record<RetrieverLane, ChunkSummary[]>>;
	rankedChunks: ChunkSummary[];
	contextChunks: ChunkSummary[];
	requestId?: string;
}

/** Final prompt assembled for the LLM (dev/admin receives full text; others get a hash) */
export interface PipelinePromptEvent {
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

/** Unified per-step UI state (rawrag + llmwiki). The waterfall + step list render these. */
export interface NragTraceStep {
	id: PipelineStepId;
	/** Stable list key — `id`, except dynamic drills → `drill#${ordinal}`. */
	instanceKey: string;
	label: string;
	phase: NragPhase;
	lane?: RetrieverLane;
	path: 'rawrag' | 'llmwiki' | 'both';
	status: PipelineStepStatus;
	/** ms from turn t0 to step start; drives waterfall bar position. */
	startOffsetMs?: number;
	durationMs?: number;
	error?: string;
	detail?: StepDetail;
}

/** Static descriptor for a pipeline step (label/phase/lane/path), the trace seed. */
export interface PipelineStepDescriptor {
	id: PipelineStepId;
	label: string;
	phase: NragPhase;
	path: 'rawrag' | 'llmwiki' | 'both';
	lane?: RetrieverLane;
	/** Appended dynamically per occurrence (drill); not seeded as pending. */
	dynamic?: boolean;
}

/** Single registry replacing PIPELINE_STEPS + LLMWIKI_STEPS. Filtered by `path` per engine. */
export const PIPELINE_REGISTRY: PipelineStepDescriptor[] = [
	{ id: 'embed', label: 'Embed', phase: 'embed', path: 'rawrag' },
	{ id: 'tier-1', label: 'Vector', phase: 'retrieve', path: 'rawrag', lane: 'tier-1' },
	{ id: 'tier-2', label: 'Small-to-Big', phase: 'retrieve', path: 'rawrag', lane: 'tier-2' },
	{ id: 'tier-3', label: 'Entity Graph', phase: 'retrieve', path: 'rawrag', lane: 'tier-3' },
	{ id: 'rank', label: 'Rank', phase: 'fuse', path: 'rawrag' },
	{ id: 'context', label: 'Context', phase: 'assemble', path: 'rawrag' },
	{ id: 'llmwiki:overview', label: 'Overview', phase: 'retrieve', path: 'llmwiki', lane: 'llmwiki' },
	{ id: 'llmwiki:search', label: 'Wiki Search', phase: 'retrieve', path: 'llmwiki', lane: 'llmwiki' },
	{ id: 'system-docs', label: 'System Docs', phase: 'retrieve', path: 'llmwiki', lane: 'tier-1' },
	{ id: 'llmwiki:context', label: 'Context', phase: 'assemble', path: 'llmwiki' },
	{ id: 'generate', label: 'Generate', phase: 'generate', path: 'both' },
	{ id: 'rawrag:drill', label: 'Drill', phase: 'retrieve', path: 'llmwiki', lane: 'llmwiki', dynamic: true },
	{ id: 'llmwiki:verify', label: 'Verify', phase: 'verify', path: 'llmwiki' },
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
