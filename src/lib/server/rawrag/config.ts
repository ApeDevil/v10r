export {
	CHUNK_OVERLAP,
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_MODEL_ID,
	MAX_CHUNKS_PER_DOCUMENT,
	MAX_CONTEXT_CHUNKS,
	MAX_GRAPH_HOPS,
	MAX_TOTAL_CHUNKS,
	OVERFETCH_MULTIPLIER,
	PARAGRAPH_CHUNK_TARGET,
	RRF_K,
	SECTION_CHUNK_TARGET,
} from '$lib/server/config';

/**
 * Re-exported from `db/rag/limits.ts`, which owns the definition (db is the
 * allowed downward-import target for domain modules; see
 * docs/codebase-organization.md, Import-direction rule #4). Kept here so
 * existing rawrag-side importers are unaffected.
 */
export { MAX_DOCUMENTS_PER_USER } from '$lib/server/db/rag/limits';
