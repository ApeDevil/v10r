#!/usr/bin/env bun
/**
 * One-off / idempotent: ensure the blog FTS column + GIN index exist and
 * backfill `search_vector` for any revision that predates the column.
 *
 * `db:push` already creates the column + index from the Drizzle schema, and
 * `createRevision()` populates the vector on every new insert — so this script
 * is only needed once after introducing search (or as a reconcile safety net).
 * Run: `bun run db:search-backfill`
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

// Locale → Postgres regconfig (kept in sync with $lib/server/search/regconfig.ts).
const LOCALE_CONFIGS: Array<[string, string]> = [
	['en', 'english'],
	['de', 'german'],
	['ru', 'russian'],
];

async function run() {
	// 1. Ensure column + GIN index exist (idempotent; push normally does this).
	await db.execute(sql`ALTER TABLE blog.revision ADD COLUMN IF NOT EXISTS search_vector tsvector`);
	await db.execute(
		sql`CREATE INDEX IF NOT EXISTS blog_revision_search_vector_idx ON blog.revision USING gin (search_vector)`,
	);
	console.log('[ok] column + GIN index ensured');

	// 2. Backfill per locale with the matching regconfig.
	for (const [loc, cfg] of LOCALE_CONFIGS) {
		const res = await db.execute(sql`
			UPDATE blog.revision SET search_vector =
				setweight(to_tsvector(${cfg}::regconfig, title), 'A')
				|| setweight(to_tsvector(${cfg}::regconfig, coalesce(summary, '')), 'B')
				|| setweight(to_tsvector(${cfg}::regconfig, markdown), 'C')
			WHERE locale = ${loc} AND search_vector IS NULL
		`);
		console.log(`[ok] backfilled ${loc} (${res.rowCount ?? 0} rows)`);
	}

	// 3. Anything with an unrecognized locale → 'simple' (no stemming).
	const rest = await db.execute(sql`
		UPDATE blog.revision SET search_vector =
			setweight(to_tsvector('simple', title), 'A')
			|| setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
			|| setweight(to_tsvector('simple', markdown), 'C')
		WHERE search_vector IS NULL
	`);
	console.log(`[ok] backfilled remaining locales as 'simple' (${rest.rowCount ?? 0} rows)`);
}

await run();
console.log('\n[ok] blog search backfill complete');
await pool.end();
