#!/usr/bin/env bun
/**
 * One-off: add the `conv_step_provider_idx (provider_id, created_at)` index that
 * backs the per-provider usage aggregate (getProviderUsageToday) for the admin
 * quota board. Bypasses `drizzle-kit push` to avoid the 0.31.x interactive
 * re-prompt bug for unrelated nullsNotDistinct() uniques (see project memory).
 *
 * Idempotent: future `db:push` sees the index already exists.
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.poolQueryViaFetch = true;

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

const statements = [
	sql`CREATE INDEX IF NOT EXISTS conv_step_provider_idx ON ai.conversation_step (provider_id, created_at)`,
];

for (const stmt of statements) {
	const text = (stmt as unknown as { queryChunks?: { value?: string[] }[] }).queryChunks?.[0]?.value?.[0] ?? '<sql>';
	process.stdout.write(`→ ${text.trim().slice(0, 80)}…  `);
	await db.execute(stmt);
	process.stdout.write('ok\n');
}

console.log('\n[ok] conv_step_provider_idx applied');
await pool.end();
