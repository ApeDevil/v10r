/** Ingestion pipeline step identifiers (write-path) */
export type IngestStepId =
	| 'insert'
	| 'chunk'
	| 'contextual_prep'
	| 'embed'
	| 'pg_upsert'
	| 'graph_mirror'
	| 'entity_extract'
	| 'done';

export type IngestStepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

export interface IngestStepEvent {
	type: 'ingest:step';
	step: IngestStepId;
	status: IngestStepStatus;
	durationMs?: number;
	error?: string;
	detail?: Record<string, unknown>;
}

export interface IngestDoneEvent {
	type: 'ingest:done';
	documentId: string;
	chunkCount: number;
	entityCount: number;
	durationMs: number;
}

export type IngestEvent = IngestStepEvent | IngestDoneEvent;
