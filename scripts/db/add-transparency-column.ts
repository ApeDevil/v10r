#!/usr/bin/env bun
/**
 * One-off / idempotent: add `transparency_seen_at` to app.user_preferences
 * (first-signup marker for the data-transparency page).
 *
 * WHY a script instead of `db:push`: drizzle-kit push raw-TTY re-prompts
 * (nullsNotDistinct truncate question) cannot be piped/automated; additive
 * DDL is applied directly instead. The column is nullable with no default,
 * so this is metadata-only and safe on a live table.
 * Run: `bun run scripts/db/add-transparency-column.ts`
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

await db.execute(sql`ALTER TABLE app.user_preferences ADD COLUMN IF NOT EXISTS transparency_seen_at timestamptz`);

const [check] = (
	await db.execute(sql`
		SELECT column_name, data_type, is_nullable
		FROM information_schema.columns
		WHERE table_schema = 'app' AND table_name = 'user_preferences' AND column_name = 'transparency_seen_at'
	`)
).rows;

console.log(check ? `✓ app.user_preferences.transparency_seen_at present (${check.data_type})` : '✗ column missing!');
await pool.end();
process.exit(check ? 0 : 1);
