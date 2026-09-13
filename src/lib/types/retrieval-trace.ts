/**
 * Retrieval observability contract — the per-turn trace events the retrieval kernel
 * (`retrieve()`) emits, plus the step model the deskbot showcase's recorded turns replay.
 *
 * Three ORTHOGONAL axes describe a step/chunk:
 *   - STAGE     `RetrievalPhase`  temporal phase — a waterfall lays out by this
 *   - RETRIEVER `RetrieverId`     which retriever produced it
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
	/** Coarse retriever for the chatbot's parallel tier-1 system-docs retrieve. */
	| 'system-docs'
	/** The assembly's catalog search on a navigation question (`<catalog-results>`) — no embedding. */
	| 'catalog';

export type RetrievalStepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

/**
 * Which engine a step belongs to — the registry is filtered by this: the retrieval kernel's
 * own steps (`chunks`), the chatbot's turn composition (`compose`), or both.
 */
export type RetrievalEngine = 'chunks' | 'compose' | 'both';

/** STAGE axis — the temporal phase a step belongs to. The waterfall groups bars by this. */
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
	'system-docs': 'retrieve',
	catalog: 'retrieve',
};

/** RETRIEVER axis — which retriever produced a step's/chunk's results (tierChunks keys). */
export type RetrieverId = 'tier-1' | 'tier-2' | 'tier-3';

/** Per-retriever provenance; distinguishes the retrievers that folded into one chunk. */
export type RetrieverKind = 'vector' | 'bm25' | 'parentChild' | 'graph';

/** Step → retriever (only retrieve-phase steps have one). */
export const RETRIEVER_OF: Partial<Record<RetrievalStepId, RetrieverId>> = {
	'tier-1': 'tier-1',
	'tier-2': 'tier-2',
	'tier-3': 'tier-3',
	'system-docs': 'tier-1',
};

/** Step-specific metadata (discriminated union) */
export type StepDetail = EmbedDetail | TierDetail | RankDetail | ContextDetail | GenerateDetail | CatalogDetail;

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
	/**
	 * Orchestrator entry → the `start` frame: conversation resolution, the user + assistant
	 * row writes, history conversion. Everything the client waits on BEFORE any frame.
	 */
	preStreamMs?: number;
	/** Model steps this turn (1 = no tool round-trip). */
	steps?: number;
	/** Per step, ms from the step's start to its first streamed token (text, reasoning or tool input). */
	firstTokenMs?: number[];
	/** Tool executions this turn, in call order, with their own execution time. */
	tools?: { name: string; ms: number }[];
	/** Post-text work while the message is still open, per stage (absent = stage skipped). */
	finalize?: { catalogMs?: number; persistMs?: number; budgetMs?: number };
}

/** The assembly's navigation grounding: how many verified catalog rows entered the prompt. */
export interface CatalogDetail {
	kind: 'catalog';
	hits: number;
	/** The surface the question named ("…showcase", "…docs"), when it named one. */
	surface: string | null;
}

/** Event emitted by the instrumented retrieval pipeline */
export interface RetrievalStepEvent {
	type: 'pipeline:step';
	step: RetrievalStepId;
	/** Closed STAGE discriminant — the viz groups by this, never by string-matching `step`. */
	phase: RetrievalPhase;
	/** Stable per-instance key (= step, except dynamic steps → `${step}#${n}`). */
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
	tier: 1 | 2 | 3;
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

/** Unified per-step UI state (kernel + composition). The waterfall + step list render these. */
export interface RetrievalTraceStep {
	id: RetrievalStepId;
	/** Stable list key — `id`, except dynamic steps → `${id}#${ordinal}`. */
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
	/** Appended dynamically per occurrence; not seeded as pending. */
	dynamic?: boolean;
}

/** The one step registry, filtered by `engine`. */
export const RETRIEVAL_STEPS: RetrievalStepDescriptor[] = [
	{ id: 'embed', label: 'Embed', phase: 'embed', engine: 'chunks' },
	{ id: 'tier-1', label: 'Vector', phase: 'retrieve', engine: 'chunks', retriever: 'tier-1' },
	{ id: 'tier-2', label: 'Small-to-Big', phase: 'retrieve', engine: 'chunks', retriever: 'tier-2' },
	{ id: 'tier-3', label: 'Entity Graph', phase: 'retrieve', engine: 'chunks', retriever: 'tier-3' },
	{ id: 'rank', label: 'Rank', phase: 'fuse', engine: 'chunks' },
	{ id: 'context', label: 'Context', phase: 'assemble', engine: 'chunks' },
	{ id: 'system-docs', label: 'System Docs', phase: 'retrieve', engine: 'compose', retriever: 'tier-1' },
	{ id: 'generate', label: 'Generate', phase: 'generate', engine: 'both' },
	{ id: 'catalog', label: 'Catalog', phase: 'retrieve', engine: 'compose', dynamic: true },
];
