/** A retrieved chunk with relevance metadata */
export interface RankedChunk {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	content: string;
	score: number;
	source: 'vector' | 'bm25' | 'graph';
	tier: 1 | 2 | 3;
}

/** What the retrieval system returns */
export interface RetrievalResult {
	chunks: RankedChunk[];
	entities: RetrievedEntity[];
	tierUsed: (1 | 2 | 3)[];
	durationMs: number;
}

/** Entity context from graph traversal */
export interface RetrievedEntity {
	name: string;
	type: string;
	related: string[];
}

/** Options for retrieve() */
export interface RetrievalOptions {
	userId: string;
	maxChunks?: number;
	tiers?: (1 | 2 | 3)[];
	graphDepth?: number;
	collectionId?: string;
}

/** Input for the ingestion pipeline */
export interface IngestableDocument {
	title: string;
	content: string;
	sourcePath?: string;
	sourceType?: 'upload' | 'web' | 'text' | 'api';
	userId?: string;
}

/** Result from ingestion */
export interface IngestResult {
	documentId: string;
	chunkCount: number;
	entityCount: number;
	durationMs: number;
}

/** A chunk before it has an embedding (used during ingestion) */
export interface RawChunk {
	id: string;
	content: string;
	contextPrefix?: string;
	level: 'sentence' | 'paragraph' | 'section';
	position: number;
	tokenCount: number;
	contentHash: string;
	parentId?: string;
}
