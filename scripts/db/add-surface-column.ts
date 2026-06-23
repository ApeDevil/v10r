#!/usr/bin/env bun
/**
 * One-off / idempotent additive DDL: the `ai.ai_surface` enum + nullable `surface`
 * columns on `ai.conversation` and `ai.conversation_step` (+ analytics index).
 *
 * WHY a script (not `db:push`): drizzle-kit 0.31.x re-prompts for the pre-existing
 * `nullsNotDistinct` UNIQUE on every push (known bug) — an interactive raw-TTY prompt
 * that can't be piped. Applying the additive DDL directly is deterministic and
 * idempotent; the schema file (`db/schema/ai/conversation.ts`) stays the SSOT, so a
 * fresh DB still gets these via `db:push`.
 *
 * Run: `bun run scripts/db/add-surface-column.ts`
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.poolQueryViaFetch = true;

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

// Enum (guarded — CREATE TYPE has no IF NOT EXISTS).
await db.execute(sql`
	DO $$ BEGIN
		IF NOT EXISTS (
			SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE t.typname = 'ai_surface' AND n.nspname = 'ai'
		) THEN
			CREATE TYPE ai.ai_surface AS ENUM ('chatbot', 'deskbot');
		END IF;
	END $$;
`);
console.log('[ok] enum ai.ai_surface');

await db.execute(sql`ALTER TABLE ai.conversation ADD COLUMN IF NOT EXISTS surface ai.ai_surface`);
console.log('[ok] ai.conversation.surface');

await db.execute(sql`ALTER TABLE ai.conversation_step ADD COLUMN IF NOT EXISTS surface ai.ai_surface`);
console.log('[ok] ai.conversation_step.surface');

await db.execute(sql`CREATE INDEX IF NOT EXISTS conv_step_surface_idx ON ai.conversation_step (surface, created_at)`);
console.log('[ok] index conv_step_surface_idx');

// 'desk' source value for the deskbot nRAG corpus (user-owned desk files).
await db.execute(sql`ALTER TYPE rag.document_source ADD VALUE IF NOT EXISTS 'desk'`);
console.log('[ok] enum value rag.document_source.desk');

await pool.end();
console.log('\n[done] additive DDL applied');
