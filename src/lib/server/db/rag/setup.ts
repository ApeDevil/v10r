/**
 * RAG schema setup — idempotent SQL for features Drizzle can't express natively.
 * Run via `bun run db:rag-post` after `drizzle-kit push`.
 *
 * Creates: pgvector extension, HNSW index, and seeds the default embedding model.
 *
 * The `search_vector` generated column and its GIN index now live in the
 * Drizzle schema itself (`schema/rag/chunk.ts`) via `customType('tsvector')`
 * + `.generatedAlwaysAs(...)` and `.using('gin', ...)`. HNSW stays here because
 * Drizzle's index DSL can't express `USING hnsw (... vector_cosine_ops) WITH (...)`.
 */
import { sql } from 'drizzle-orm';
import {
	AI_MAX_TOKENS,
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_MODEL_ID,
	HNSW_EF_CONSTRUCTION,
	HNSW_M,
} from '$lib/server/config';
import { db } from '../index';

/** Enable the pgvector extension (Neon supports this on all plans). */
async function enablePgvector() {
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
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

	console.log('[rag:setup] Creating HNSW index on embedding...');
	await createEmbeddingIndex();

	console.log('[rag:setup] Seeding default embedding model...');
	await seedEmbeddingModel();

	console.log('[rag:setup] Done.');
}
