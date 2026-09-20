/**
 * Retrieval observability contract — the per-step events the retrieval kernel (`retrieve()`)
 * emits to an `onEvent` listener, and the retriever axis the turn trace keys chunks by.
 *
 * Two ORTHOGONAL axes describe a step/chunk:
 *   - RETRIEVER `RetrieverId`     which retriever produced it
 *   - CORPUS    `RetrievalCorpus` which corpus (in $lib/types/retrieval-corpora.ts)
 */

/** Retrieval step identifiers — ordered by execution flow */
export type RetrievalStepId = 'embed' | 'tier-1' | 'tier-2' | 'tier-3' | 'rank' | 'context';

export type RetrievalStepStatus = 'active' | 'done' | 'error';

/** RETRIEVER axis — which retriever produced a step's/chunk's results (tierChunks keys). */
export type RetrieverId = 'tier-1' | 'tier-2' | 'tier-3';

/** Step-specific metadata (discriminated union) */
export type StepDetail = EmbedDetail | TierDetail | RankDetail | ContextDetail;

export interface EmbedDetail {
	kind: 'embed';
	dimensions: number;
	/** Echoed query text (redacted in non-dev contexts) */
	query?: string;
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

/** Event emitted by the instrumented retrieval pipeline */
export interface RetrievalStepEvent {
	type: 'pipeline:step';
	step: RetrievalStepId;
	status: RetrievalStepStatus;
	durationMs?: number;
	error?: string;
	detail?: StepDetail;
}
