/**
 * Retrieval schema setup — two phases.
 *
 * Phase 1 (pre-push):  pgvector extension — must run BEFORE db:push
 * Phase 2 (post-push): the default embedding-model row — must run AFTER push
 *
 * Usage (standalone):
 *   bun run db:retrieval-pre    # phase 1
 *   bun run db:push       # apply schema
 *   bun run db:retrieval-post   # phase 2
 *
 * Or use the composite command:
 *   bun run db:setup      # runs all phases in order
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

// Route queries over HTTP fetch instead of WebSocket.
// Bun's ws implementation mishandles WebSocket upgrade (HTTP 101).
neonConfig.poolQueryViaFetch = true;

const NEON_DATABASE_URL_PROD = process.env.NEON_DATABASE_URL_PROD;
if (!NEON_DATABASE_URL_PROD) {
	console.error('NEON_DATABASE_URL_PROD is not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: NEON_DATABASE_URL_PROD });
const db = drizzle(pool);

const phase = process.argv[2];

/** Phase 1: extensions required before migration. */
async function prePush() {
	console.log('[retrieval:pre] Enabling pgvector extension...');
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

	console.log('[retrieval:pre] Done. Now run: bun run db:push');
}

/**
 * Phase 2: seed data only. Every index — including the HNSW index on
 * `chunk.embedding` — is declared in the Drizzle schema (`schema/retrieval/chunk.ts`),
 * because `db:push` drops indexes it does not find there: the HNSW index this script
 * used to create was lost exactly that way.
 */
async function postPush() {
	console.log('[retrieval:post] Seeding default embedding model...');
	await db.execute(sql`
		INSERT INTO retrieval.embedding_model (id, provider, model_name, dimensions, max_tokens, is_default)
		VALUES ('google-gemini-embedding-001', 'google', 'gemini-embedding-001', 1536, 2048, true)
		ON CONFLICT (id) DO NOTHING
	`);

	console.log('[retrieval:post] Done.');
}

async function main() {
	if (phase === 'pre') {
		await prePush();
	} else if (phase === 'post') {
		await postPush();
	} else {
		console.error('Usage: bun run scripts/db/setup-retrieval.ts <pre|post>');
		process.exit(1);
	}
	await pool.end();
}

main().catch((err) => {
	console.error('[retrieval:setup] Failed:', err);
	process.exit(1);
});
