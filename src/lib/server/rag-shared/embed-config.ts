/**
 * embed-config — the single source of truth for embedding model identity + chunk
 * sizing, shared by BOTH the in-app RAG pipeline and the standalone Bun ingestion
 * scripts (scripts/db/ingest-docs.ts, scripts/db/catalog-sync.ts).
 *
 * It MUST stay dependency-free — no `$lib`, no `$env`, no `import.meta` — because the
 * Bun scripts import it by relative path and cannot resolve Vite aliases. The scripts
 * must never re-declare these constants — copies drift. `src/lib/server/config.ts`
 * re-exports them so app import sites are unchanged.
 */

/** Embedding model identifier (provider model name). */
export const EMBEDDING_MODEL = 'gemini-embedding-001';

/** Embedding model row id (rag.embedding_model.id / chunk.embedding_model_id). */
export const EMBEDDING_MODEL_ID = 'google-gemini-embedding-001';

/** Embedding vector dimensions. Must match the `vector(N)` column width. */
export const EMBEDDING_DIMENSIONS = 1536;

/** Section-level (parent) chunk target, approximate tokens. */
export const SECTION_CHUNK_TARGET = 1000;

/** Paragraph-level (child) chunk target, approximate tokens. */
export const PARAGRAPH_CHUNK_TARGET = 300;

/** Token overlap carried between adjacent child chunks. */
export const CHUNK_OVERLAP = 50;
