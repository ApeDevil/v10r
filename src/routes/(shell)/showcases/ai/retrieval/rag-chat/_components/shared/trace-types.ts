import type { PipelineStepStatus, StepDetail } from '$lib/types/pipeline';

export interface TraceStep {
	readonly id: string;
	readonly label: string;
	readonly status: PipelineStepStatus;
	readonly durationMs?: number;
	readonly error?: string;
	readonly detail?: StepDetail;
}

export interface RetrievalTrace {
	readonly steps: readonly TraceStep[];
	readonly isActive: boolean;
	readonly totalDurationMs: number;
	readonly summaryLabel: string;
	processAnnotations(annotations: unknown[]): void;
	reset(): void;
	resetCursor(): void;
}
