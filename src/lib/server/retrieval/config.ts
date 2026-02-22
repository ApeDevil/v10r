/** Embedding model configuration */
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_MODEL_ID = 'google-gemini-embedding-001';

/** Chunk size targets (approximate tokens) */
export const SECTION_CHUNK_TARGET = 1000;
export const PARAGRAPH_CHUNK_TARGET = 300;

/** Chunk overlap (tokens) */
export const CHUNK_OVERLAP = 50;

/** Maximum chunks injected into prompt context */
export const MAX_CONTEXT_CHUNKS = 5;

/** Graph traversal hard limit */
export const MAX_GRAPH_HOPS = 2;

/** Reciprocal rank fusion constant */
export const RRF_K = 60;

/** Over-fetch multiplier for pre-fusion retrieval */
export const OVERFETCH_MULTIPLIER = 3;

/** Maximum documents per user */
export const MAX_DOCUMENTS_PER_USER = 100;

/** Maximum total chunks across all documents */
export const MAX_TOTAL_CHUNKS = 10_000;

/** Maximum child chunks per document (limits LLM calls during ingestion) */
export const MAX_CHUNKS_PER_DOCUMENT = 50;
