/**
 * Retrieval policy — corpus identity, fusion/ranking constants, and the rate limits on
 * the ingest and search endpoints.
 *
 * Embedding model identity and chunk sizing are NOT here: they live in the dependency-free
 * `retrieval-shared/embed-config` leaf so the standalone Bun ingest scripts can import the same
 * values by relative path. Never re-declare them.
 */

// Docs corpus (project documentation retrieval)

/**
 * Reserved system user that owns every ingested project-documentation row. Each
 * The retrieval query hard-filters `user_id`, so docs must be owned by a real,
 * stable user id the orchestrator can substitute when querying the docs corpus.
 */
export const SYSTEM_DOCS_USER_ID = 'system-docs';

/** Reserved llmwiki collection holding the project-documentation corpus. */
export const PROJECT_DOCS_COLLECTION_ID = 'project-docs';

/** Maximum chunks injected into prompt context */
export const MAX_CONTEXT_CHUNKS = 5;

/** Graph traversal hard limit (hops) */
export const MAX_GRAPH_HOPS = 2;

/** Reciprocal rank fusion constant */
export const RRF_K = 60;

/** Over-fetch multiplier for pre-fusion retrieval */
export const OVERFETCH_MULTIPLIER = 3;

/** Maximum child chunks per document (limits LLM calls during ingestion) */
export const MAX_CHUNKS_PER_DOCUMENT = 50;

/** Ingest endpoint rate limit: requests per window */
export const INGEST_RATE_LIMIT_MAX = 5;

/** Ingest endpoint rate limit: window duration */
export const INGEST_RATE_LIMIT_WINDOW = '1h';

/** Search endpoint rate limit: requests per window */
export const SEARCH_RATE_LIMIT_MAX = 30;

/** Search endpoint rate limit: window duration */
export const SEARCH_RATE_LIMIT_WINDOW = '1m';

/**
 * Re-exported, not re-declared. `retrieval-shared/embed-config` is the single declaration —
 * it stays dependency-free so the standalone Bun ingest scripts can import it by
 * relative path — and this line gives retrieval code one place to look.
 */
export {
	CHUNK_OVERLAP,
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_MODEL_ID,
	PARAGRAPH_CHUNK_TARGET,
	SECTION_CHUNK_TARGET,
} from '../retrieval-shared/embed-config';
