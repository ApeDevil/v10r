/**
 * Cycle showcase — shared types and constants.
 * These are used by both server and client code, so they live here
 * outside $lib/server/ to avoid SvelteKit's server-only guard.
 */

export type CycleStageId =
	// Default HTTP lifecycle
	| 'browser'
	| 'network'
	| 'server'
	| 'domain'
	| 'database'
	| 'response'
	// AI-specific lifecycle (replaces domain/database for the AI trigger)
	| 'embed'
	| 'retrieve'
	| 'rank'
	| 'context'
	| 'generate';

/**
 * Stage status.
 * - `blocked`: upstream error prevented this stage from running.
 *   (Kept distinct from `skipped`, which is reserved for deliberately bypassed stages.)
 */
export type CycleStageStatus = 'pending' | 'active' | 'done' | 'error' | 'blocked';

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

/** Which error to simulate (form/api paths). */
export type SimulateError = 'validation' | 'domain' | 'db';

/** Which error to simulate (AI path). */
export type SimulateAiError = 'embed' | 'retrieve' | 'generate';

/** Labels for every known stage. */
export const STAGE_LABELS: Record<CycleStageId, string> = {
	browser: 'Browser',
	network: 'Network',
	server: 'Server',
	domain: 'Domain',
	database: 'Database',
	response: 'Response',
	embed: 'Embed',
	retrieve: 'Retrieve',
	rank: 'Rank',
	context: 'Context',
	generate: 'Generate',
};

/** Default (form / api) cycle stages. */
export const CYCLE_STAGES: { id: CycleStageId; label: string }[] = [
	{ id: 'browser', label: STAGE_LABELS.browser },
	{ id: 'network', label: STAGE_LABELS.network },
	{ id: 'server', label: STAGE_LABELS.server },
	{ id: 'domain', label: STAGE_LABELS.domain },
	{ id: 'database', label: STAGE_LABELS.database },
	{ id: 'response', label: STAGE_LABELS.response },
];

/** AI cycle stages. Embed/retrieve/rank/context/generate replace domain+database. */
export const AI_CYCLE_STAGES: { id: CycleStageId; label: string }[] = [
	{ id: 'browser', label: STAGE_LABELS.browser },
	{ id: 'network', label: STAGE_LABELS.network },
	{ id: 'server', label: STAGE_LABELS.server },
	{ id: 'embed', label: STAGE_LABELS.embed },
	{ id: 'retrieve', label: STAGE_LABELS.retrieve },
	{ id: 'rank', label: STAGE_LABELS.rank },
	{ id: 'context', label: STAGE_LABELS.context },
	{ id: 'generate', label: STAGE_LABELS.generate },
	{ id: 'response', label: STAGE_LABELS.response },
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
	/** Client-side (browser + network) vs server-side, for the boundary band. */
	side?: 'client' | 'server';
}

export type CycleViewMode = 'idle' | 'running' | 'complete' | 'error';

/**
 * Stage color tokens. Each stage has a distinct chart hue — no duplicates,
 * and `browser` uses a real chart color (not `--color-fg`) so it reads
 * consistently across themes.
 */
export const STAGE_COLORS: Record<CycleStageId, string> = {
	browser: 'var(--chart-6)',
	network: 'var(--chart-2)',
	server: 'var(--color-primary)',
	domain: 'var(--chart-3)',
	database: 'var(--chart-4)',
	response: 'var(--chart-5)',
	embed: 'var(--chart-8)',
	retrieve: 'var(--chart-3)',
	rank: 'var(--chart-7)',
	context: 'var(--chart-1)',
	generate: 'var(--chart-4)',
};

/** Which stages live on the client vs server for the boundary band. */
export const STAGE_SIDES: Record<CycleStageId, 'client' | 'server'> = {
	browser: 'client',
	network: 'client',
	server: 'server',
	domain: 'server',
	database: 'server',
	response: 'server',
	embed: 'server',
	retrieve: 'server',
	rank: 'server',
	context: 'server',
	generate: 'server',
};
