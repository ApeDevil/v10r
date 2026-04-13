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

export interface IngestStepState {
	id: IngestStepId;
	label: string;
	description: string;
	status: IngestStepStatus;
	durationMs?: number;
	error?: string;
}

export const INGEST_STEPS: { id: IngestStepId; label: string; description: string }[] = [
	{ id: 'insert', label: 'Insert', description: 'Create document record (status=processing)' },
	{ id: 'chunk', label: 'Chunk', description: 'Hierarchical chunking — sections and paragraphs' },
	{
		id: 'contextual_prep',
		label: 'Contextualize',
		description: 'LLM writes a short context prefix for every child chunk',
	},
	{ id: 'embed', label: 'Embed', description: 'Vector embeddings for children (parents are just context containers)' },
	{
		id: 'pg_upsert',
		label: 'Upsert',
		description: 'Batch insert into Postgres — tsvector auto-generates for BM25',
	},
	{ id: 'graph_mirror', label: 'Graph mirror', description: 'Mirror chunk tree into Neo4j' },
	{
		id: 'entity_extract',
		label: 'Entities',
		description: 'Extract entities + RELATED_TO edges from section text',
	},
	{ id: 'done', label: 'Done', description: 'Document is ready for retrieval' },
];
