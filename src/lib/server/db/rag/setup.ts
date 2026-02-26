/**
 * RAG schema setup — idempotent SQL for features Drizzle can't express natively.
 * Run via `bun run db:rag-post` after `drizzle-kit push`.
 *
 * Creates: pgvector extension, generated tsvector column, HNSW + GIN indexes,
 * and seeds the default embedding model.
 */
import { sql } from 'drizzle-orm';
import { db } from '../index';
import { HNSW_M, HNSW_EF_CONSTRUCTION, EMBEDDING_DIMENSIONS, AI_MAX_TOKENS, EMBEDDING_MODEL_ID, EMBEDDING_MODEL } from '$lib/server/config';

/** Enable the pgvector extension (Neon supports this on all plans). */
async function enablePgvector() {
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
}

/**
 * Add generated tsvector column for BM25 full-text search.
 * Combines context_prefix + content for comprehensive searchability.
 */
async function addSearchVectorColumn() {
	await db.execute(sql`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'rag' AND table_name = 'chunk' AND column_name = 'search_vector'
			) THEN
				ALTER TABLE rag.chunk ADD COLUMN search_vector tsvector
					GENERATED ALWAYS AS (
						to_tsvector('english', coalesce(context_prefix, '') || ' ' || content)
					) STORED;
			END IF;
		END $$
	`);
}

/** GIN index on search_vector for full-text search. */
async function createSearchVectorIndex() {
	await db.execute(sql`
		CREATE INDEX IF NOT EXISTS chunk_search_vector_idx
			ON rag.chunk USING gin(search_vector)
	`);
}

/**
 * HNSW index on embedding for vector similarity search (cosine distance).
 * Suitable for up to ~1M vectors.
 */
async function createEmbeddingIndex() {
	await db.execute(sql`
		CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
			ON rag.chunk USING hnsw(embedding vector_cosine_ops)
			WITH (m = ${sql.raw(String(HNSW_M))}, ef_construction = ${sql.raw(String(HNSW_EF_CONSTRUCTION))})
	`);
}

/** Seed the default embedding model row. */
async function seedEmbeddingModel() {
	await db.execute(sql`
		INSERT INTO rag.embedding_model (id, provider, model_name, dimensions, max_tokens, is_default)
		VALUES (${EMBEDDING_MODEL_ID}, 'google', ${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS}, ${AI_MAX_TOKENS}, true)
		ON CONFLICT (id) DO NOTHING
	`);
}

/**
 * Run all RAG schema setup steps. Fully idempotent — safe to run repeatedly.
 */
export async function ensureRagSchema(): Promise<void> {
	console.log('[rag:setup] Enabling pgvector extension...');
	await enablePgvector();

	console.log('[rag:setup] Adding search_vector column...');
	await addSearchVectorColumn();

	console.log('[rag:setup] Creating GIN index on search_vector...');
	await createSearchVectorIndex();

	console.log('[rag:setup] Creating HNSW index on embedding...');
	await createEmbeddingIndex();

	console.log('[rag:setup] Seeding default embedding model...');
	await seedEmbeddingModel();

	console.log('[rag:setup] Done.');
}
