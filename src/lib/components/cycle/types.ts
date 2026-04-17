/**
 * Cycle showcase — shared types and constants.
 * These are used by both server and client code, so they live here
 * outside $lib/server/ to avoid SvelteKit's server-only guard.
 */

export type CycleStageId = 'browser' | 'network' | 'server' | 'domain' | 'database' | 'response';

export type CycleStageStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

/** A single measured hop in the request lifecycle. */
export interface CycleSpan {
	stage: CycleStageId;
	status: CycleStageStatus;
	startMs: number;
	durationMs?: number;
	detail?: Record<string, unknown>;
	error?: string;
}

/** A complete trace of one request lifecycle. */
export interface CycleTrace {
	id: string;
	trigger: 'form' | 'api' | 'ai';
	spans: CycleSpan[];
	totalDurationMs?: number;
	inputPayload?: Record<string, unknown>;
	outputPayload?: Record<string, unknown>;
}

/** Which error to simulate (for the demo). */
export type SimulateError = 'validation' | 'domain' | 'db';

/** Stage definitions with display labels. */
export const CYCLE_STAGES: { id: CycleStageId; label: string }[] = [
	{ id: 'browser', label: 'Browser' },
	{ id: 'network', label: 'Network' },
	{ id: 'server', label: 'Server' },
	{ id: 'domain', label: 'Domain' },
	{ id: 'database', label: 'Database' },
	{ id: 'response', label: 'Response' },
];

/** Client-side stage state enriched with display properties. */
export interface CycleStageState {
	id: CycleStageId;
	label: string;
	status: CycleStageStatus;
	durationMs?: number;
	error?: string;
	detail?: Record<string, unknown>;
	/** Milliseconds offset from trace start — used for waterfall positioning */
	startOffset?: number;
}

export type CycleViewMode = 'idle' | 'running' | 'complete' | 'error';

/** Stage color tokens for visualization. */
export const STAGE_COLORS: Record<CycleStageId, string> = {
	browser: 'var(--color-fg)',
	network: 'var(--chart-2)',
	server: 'var(--color-primary)',
	domain: 'var(--chart-3)',
	database: 'var(--chart-4)',
	response: 'var(--chart-2)',
};
