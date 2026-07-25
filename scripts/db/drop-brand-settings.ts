#!/usr/bin/env bun
/**
 * One-off: drop `app.brand_settings`.
 *
 * The site-wide brand lock was deleted — v10r has no branding, every visitor
 * picks their own style. The Drizzle schema for this table is already gone, so
 * the physical table is now an orphan.
 *
 * WHY THIS EXISTS RATHER THAN JUST `db:push`: a dropped table is a destructive
 * change, and drizzle-kit stops on an interactive confirmation for it. Those
 * prompts need a TTY that a non-interactive shell cannot supply, and they cannot
 * be piped or PTY-driven in this container.
 *
 * SAFETY: `app.brand_settings` is a singleton config row (`id = 'default'`)
 * holding a palette/typography/radius triple plus an `enabled` flag. It has no
 * foreign keys in either direction and no `brandSettingsRelations`, so nothing
 * cascades. No user-owned data lives here — `app.custom_palettes` is a separate
 * table and is NOT touched.
 *
 * The script asserts the shape it expects before dropping, so it refuses to run
 * against anything other than the table it was written for.
 *
 * Run:  bun run scripts/db/drop-brand-settings.ts
 * Then: bun run db:push — expected output is "No changes detected".
 */
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.poolQueryViaFetch = true;

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: url });

const exists = await pool.query(`
	SELECT 1 FROM information_schema.tables
	WHERE table_schema = 'app' AND table_name = 'brand_settings'
`);

if (exists.rowCount === 0) {
	console.log('[skip] app.brand_settings does not exist — nothing to do');
	await pool.end();
	process.exit(0);
}

// Refuse to drop anything that is not the singleton this script was written for.
const cols = await pool.query(`
	SELECT column_name FROM information_schema.columns
	WHERE table_schema = 'app' AND table_name = 'brand_settings'
	ORDER BY column_name
`);
const found = cols.rows.map((r) => r.column_name as string);
const expected = ['enabled', 'id', 'palette_id', 'radius_id', 'typography_id', 'updated_at'];
const unexpected = found.filter((c) => !expected.includes(c));
if (unexpected.length > 0) {
	console.error(`[abort] app.brand_settings has unexpected columns: ${unexpected.join(', ')}`);
	console.error('        This is not the table this script was written to drop. Inspect it by hand.');
	await pool.end();
	process.exit(1);
}

// Anything referencing this table would make the drop a cascade, not a drop.
const refs = await pool.query(`
	SELECT c.conname, c.conrelid::regclass AS referencing_table
	FROM pg_constraint c
	WHERE c.contype = 'f' AND c.confrelid = 'app.brand_settings'::regclass
`);
if (refs.rowCount && refs.rowCount > 0) {
	console.error('[abort] unexpected inbound foreign keys:');
	for (const r of refs.rows) console.error(`        ${r.referencing_table} (${r.conname})`);
	await pool.end();
	process.exit(1);
}

const rows = await pool.query('SELECT count(*)::int AS n FROM app.brand_settings');
console.log(`[info] dropping app.brand_settings (${rows.rows[0].n} row(s), no inbound FKs)`);

await pool.query('DROP TABLE app.brand_settings');

console.log('[ok] app.brand_settings dropped');
console.log('     next: bun run db:push — expected "No changes detected"');
await pool.end();
