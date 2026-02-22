/**
 * Runner script for RAG schema setup.
 * Usage: bun run db:setup-rag
 *
 * Must run AFTER `drizzle-kit push` creates the base rag schema tables.
 * Adds pgvector extension, tsvector column, HNSW + GIN indexes, and seeds data.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function main() {
	console.log('[rag:setup] Enabling pgvector extension...');
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

	console.log('[rag:setup] Adding search_vector column...');
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

	console.log('[rag:setup] Creating GIN index on search_vector...');
	await db.execute(sql`
		CREATE INDEX IF NOT EXISTS chunk_search_vector_idx
			ON rag.chunk USING gin(search_vector)
	`);

	console.log('[rag:setup] Creating HNSW index on embedding...');
	await db.execute(sql`
		CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
			ON rag.chunk USING hnsw(embedding vector_cosine_ops)
			WITH (m = 16, ef_construction = 64)
	`);

	console.log('[rag:setup] Seeding default embedding model...');
	await db.execute(sql`
		INSERT INTO rag.embedding_model (id, provider, model_name, dimensions, max_tokens, is_default)
		VALUES ('openai-text-embedding-3-small', 'openai', 'text-embedding-3-small', 1536, 8191, true)
		ON CONFLICT (id) DO NOTHING
	`);

	console.log('[rag:setup] Done.');
	await pool.end();
}

main().catch((err) => {
	console.error('[rag:setup] Failed:', err);
	process.exit(1);
});
