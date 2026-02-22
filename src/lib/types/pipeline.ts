/** Pipeline step identifiers — ordered by execution flow */
export type PipelineStepId = 'embed' | 'tier-1' | 'tier-2' | 'tier-3' | 'rank' | 'context' | 'generate';

export type PipelineStepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

/** Step-specific metadata (discriminated union) */
export type StepDetail =
	| EmbedDetail
	| TierDetail
	| RankDetail
	| ContextDetail
	| GenerateDetail;

export interface EmbedDetail {
	kind: 'embed';
	dimensions: number;
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
}

/** Event emitted by the instrumented retrieval pipeline */
export interface PipelineStepEvent {
	type: 'pipeline:step';
	step: PipelineStepId;
	status: PipelineStepStatus;
	durationMs?: number;
	error?: string;
	detail?: StepDetail;
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
	{ id: 'tier-1', label: 'T1 Contextual' },
	{ id: 'tier-2', label: 'T2 Parent-Child' },
	{ id: 'tier-3', label: 'T3 Graph' },
	{ id: 'rank', label: 'Rank' },
	{ id: 'context', label: 'Context' },
	{ id: 'generate', label: 'Generate' },
];
