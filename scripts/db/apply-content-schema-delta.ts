#!/usr/bin/env bun
/**
 * One-off: apply the 3 column additions for the content workflow.
 * Bypasses `drizzle-kit push` to avoid the 0.31.x interactive re-prompt
 * bug for unrelated nullsNotDistinct() unique constraints (see project memory).
 *
 * After this runs, future `db:push` invocations will see the columns already
 * exist and won't re-add them; the unrelated re-prompts will continue to
 * surface until drizzle-kit fixes them.
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

const statements = [
	sql`ALTER TABLE blog.post ADD COLUMN IF NOT EXISTS source_path text`,
	sql`CREATE UNIQUE INDEX IF NOT EXISTS blog_post_source_path_idx ON blog.post (source_path) WHERE source_path IS NOT NULL`,
	sql`ALTER TABLE blog.revision ADD COLUMN IF NOT EXISTS source_content_hash text`,
	sql`ALTER TABLE blog.revision ADD COLUMN IF NOT EXISTS translated_by text`,
];

for (const stmt of statements) {
	const text = (stmt as unknown as { queryChunks?: { value?: string[] }[] }).queryChunks?.[0]?.value?.[0] ?? '<sql>';
	process.stdout.write(`→ ${text.trim().slice(0, 80)}…  `);
	await db.execute(stmt);
	process.stdout.write('ok\n');
}

console.log('\n[ok] schema delta applied');
await pool.end();
