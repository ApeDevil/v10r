/** Pipeline step identifiers — ordered by execution flow */
export type PipelineStepId = 'embed' | 'tier-1' | 'tier-2' | 'tier-3' | 'rank' | 'context' | 'generate';

export type PipelineStepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

/** Step-specific metadata (discriminated union) */
export type StepDetail = EmbedDetail | TierDetail | RankDetail | ContextDetail | GenerateDetail;

export interface EmbedDetail {
	kind: 'embed';
	dimensions: number;
	/** Echoed query text (redacted in non-dev contexts) */
	query?: string;
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
	tokenEstimate: number;
	chunkCount: number;
}

export interface GenerateDetail {
	kind: 'generate';
	model?: string;
	inputTokens?: number;
	outputTokens?: number;
}

/** Event emitted by the instrumented retrieval pipeline */
export interface PipelineStepEvent {
	type: 'pipeline:step';
	step: PipelineStepId;
	status: PipelineStepStatus;
	durationMs?: number;
	/** Server performance.now() at step start — enables live "active for Xs" UI */
	startedAt?: number;
	error?: string;
	detail?: StepDetail;
	/** Correlation id for a single retrieval turn */
	requestId?: string;
}

/** Per-retriever score breakdown for a single chunk */
export interface ChunkRetrieverScores {
	vector?: number;
	parentChild?: number;
	graph?: number;
}

/** Why a chunk survived fusion into the final context */
export type ChunkSurvivalReason = 'top_k' | 'rrf_threshold' | 'graph_expansion' | 'parent_promoted';

/** Summary of a single retrieved chunk, sent to the client */
export interface ChunkSummary {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	contentPreview: string;
	contentLength: number;
	score: number;
	source: 'vector' | 'bm25' | 'graph';
	tier: 1 | 2 | 3;
	survived: boolean;
	/** Per-retriever raw scores (for provenance UI) */
	retrieverScores?: ChunkRetrieverScores;
	/** Final RRF score contribution (hybrid fusion only) */
	rrfContribution?: number;
	/** Rank position after RRF fusion */
	rrfRank?: number;
	/** Explains why this chunk made it into the final context */
	survivalReason?: ChunkSurvivalReason;
}

/** Chunk data event emitted after context assembly */
export interface PipelineChunksEvent {
	type: 'pipeline:chunks';
	tierChunks: Record<string, ChunkSummary[]>;
	rankedChunks: ChunkSummary[];
	contextChunks: ChunkSummary[];
}

/** Final prompt assembled for the LLM (dev/admin receives full text; others get a hash) */
export interface PipelinePromptEvent {
	type: 'pipeline:prompt_assembled';
	systemPrompt?: string;
	systemPromptHash?: string;
	userPrompt: string;
	contextBlocks: { chunkId: string; tokens: number }[];
	totalTokens: number;
}

/** Per-step UI state */
export interface PipelineStepState {
	id: PipelineStepId;
	label: string;
	status: PipelineStepStatus;
	durationMs?: number;
	error?: string;
	detail?: StepDetail;
}

/** Step definitions with labels for the UI */
export const PIPELINE_STEPS: { id: PipelineStepId; label: string }[] = [
	{ id: 'embed', label: 'Embed' },
	{ id: 'tier-1', label: 'Vector' },
	{ id: 'tier-2', label: 'Small-to-Big' },
	{ id: 'tier-3', label: 'Entity Graph' },
	{ id: 'rank', label: 'Rank' },
	{ id: 'context', label: 'Context' },
	{ id: 'generate', label: 'Generate' },
];
