#!/usr/bin/env bun
/**
 * One-off / idempotent: collapse `analytics.consent_tier` from three values
 * ('necessary','analytics','full') to two ('necessary','analytics').
 *
 * WHY: the `full` tier was dead. Nothing in the codebase gated on it, yet the
 * consent banner promised it "adds journey tracking and custom events". Under
 * EDPB Guidelines 05/2020 consent must be specific and informed, so asking for
 * a tier that grants nothing is a defect — in the over-asking direction.
 *
 * WHY A SCRIPT AND NOT `db:push`: PostgreSQL cannot DROP a value from an enum.
 * drizzle-kit therefore emits a drop-and-recreate for the type, which fails
 * against existing data (documented at docs/blueprint/data/drizzle-workflow.md).
 * The swap below does it properly: repoint the data, rename the old type aside,
 * create the new one, re-type every dependent column with an explicit USING
 * cast, then drop the old type.
 *
 * Everything runs in ONE transaction — a partial swap would leave columns typed
 * against a renamed type with no code that matches.
 *
 * Idempotent: if `full` is already gone, the script reports and exits cleanly.
 *
 * Run: `bun run scripts/db/collapse-consent-tier.ts`
 * MUST run BEFORE the next `bun run db:push`.
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

/** Every column typed `analytics.consent_tier`, with its default (null = none). */
const COLUMNS: Array<{ table: string; column: string; default: string | null }> = [
	{ table: 'analytics.events', column: 'consent_tier', default: 'necessary' },
	{ table: 'analytics.sessions', column: 'consent_tier', default: 'necessary' },
	{ table: 'analytics.consent_events', column: 'tier_before', default: null },
	{ table: 'analytics.consent_events', column: 'tier_after', default: null },
];

async function currentValues(): Promise<string[]> {
	const res = await db.execute(sql`
		SELECT e.enumlabel AS label
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typname = 'consent_tier' AND n.nspname = 'analytics'
		ORDER BY e.enumsortorder
	`);
	return res.rows.map((r) => (r as { label: string }).label);
}

const before = await currentValues();
if (before.length === 0) {
	console.error('[fail] analytics.consent_tier does not exist — run db:push first');
	await pool.end();
	process.exit(1);
}
console.log(`[info] current values: ${before.join(', ')}`);

if (!before.includes('full')) {
	console.log('[skip] `full` is already gone — nothing to do');
	await pool.end();
	process.exit(0);
}

// Report what will be rewritten before touching anything.
for (const { table, column } of COLUMNS) {
	const res = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${table} WHERE ${column} = 'full'`));
	const n = (res.rows[0] as { n: number }).n;
	if (n > 0) console.log(`[plan] ${table}.${column}: ${n} row(s) 'full' → 'analytics'`);
}

const statements: string[] = [];

// 1. Repoint existing data while the old type still accepts 'full'.
for (const { table, column } of COLUMNS) {
	statements.push(`UPDATE ${table} SET ${column} = 'analytics' WHERE ${column} = 'full'`);
}

// 2. Swap the type. Renaming rather than dropping keeps the dependent columns
//    valid for the duration of the transaction.
statements.push(`ALTER TYPE analytics.consent_tier RENAME TO consent_tier_old`);
statements.push(`CREATE TYPE analytics.consent_tier AS ENUM ('necessary', 'analytics')`);

// 3. Re-type each column. The default must be dropped first: it is typed against
//    the old type and blocks the ALTER.
for (const { table, column, default: def } of COLUMNS) {
	if (def) statements.push(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`);
	statements.push(
		`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE analytics.consent_tier USING ${column}::text::analytics.consent_tier`,
	);
	if (def) statements.push(`ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT '${def}'`);
}

statements.push(`DROP TYPE analytics.consent_tier_old`);

console.log(`\n[run] applying ${statements.length} statements in one transaction…`);
const client = await pool.connect();
try {
	await client.query('BEGIN');
	for (const stmt of statements) {
		await client.query(stmt);
		console.log(`  ✓ ${stmt.slice(0, 96)}${stmt.length > 96 ? '…' : ''}`);
	}
	await client.query('COMMIT');
} catch (err) {
	await client.query('ROLLBACK');
	console.error('\n[fail] rolled back — database is unchanged');
	console.error(err);
	client.release();
	await pool.end();
	process.exit(1);
} finally {
	client.release();
}

console.log(`\n[verify] values are now: ${(await currentValues()).join(', ')}`);
console.log('[ok] consent tier collapsed to necessary + analytics');
console.log('     next: bun run db:push (should report no diff for analytics)');
await pool.end();
