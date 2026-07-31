#!/usr/bin/env bun
/**
 * One-off / idempotent: additive DDL for the 2026-07-31 audit's constraint
 * backstops. Brings the live database in line with the schema-code CHECKs:
 *
 *   feedback.feedback   — subject ≤120 / body ≤4000 / page_of_origin ≤512
 *                         length CHECKs + DEFAULT '' on page_of_origin
 *   mcp.demo_state      — singleton id CHECK, color allowlist CHECK,
 *                         message ≤500 CHECK
 *   auth.passkey        — last_used_at → timestamptz (app-owned column)
 *
 * WHY A SCRIPT AND NOT `db:push`: drizzle-kit push prompts interactively
 * (cannot be piped) and `pushSchema()` introspects Neon as empty through
 * poolQueryViaFetch — hand-written additive DDL is the project pattern
 * (see collapse-consent-tier.ts, docs/blueprint/data/drizzle-workflow.md).
 *
 * Idempotent: every CHECK is guarded by a pg_constraint existence probe, the
 * DEFAULT/type changes are safe to re-run. Each statement validates existing
 * rows; a violating row aborts with a clear error instead of silently passing.
 *
 * Run: `bun run scripts/db/add-constraint-backstops.ts`
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

async function hasConstraint(schema: string, table: string, name: string): Promise<boolean> {
	const res = await db.execute(sql`
		SELECT 1
		FROM pg_constraint c
		JOIN pg_class t ON t.oid = c.conrelid
		JOIN pg_namespace n ON n.oid = t.relnamespace
		WHERE n.nspname = ${schema} AND t.relname = ${table} AND c.conname = ${name}
	`);
	return res.rows.length > 0;
}

const CHECKS: Array<{ schema: string; table: string; name: string; clause: string }> = [
	{
		schema: 'feedback',
		table: 'feedback',
		name: 'feedback_subject_len',
		clause: `CHECK (char_length(subject) <= 120)`,
	},
	{ schema: 'feedback', table: 'feedback', name: 'feedback_body_len', clause: `CHECK (char_length(body) <= 4000)` },
	{
		schema: 'feedback',
		table: 'feedback',
		name: 'feedback_source_len',
		clause: `CHECK (char_length(page_of_origin) <= 512)`,
	},
	{ schema: 'mcp', table: 'demo_state', name: 'mcp_demo_state_singleton', clause: `CHECK (id = 'singleton')` },
	{
		schema: 'mcp',
		table: 'demo_state',
		name: 'mcp_demo_color_allowed',
		clause: `CHECK (color IN ('blue', 'red', 'green', 'yellow', 'orange', 'purple'))`,
	},
	{
		schema: 'mcp',
		table: 'demo_state',
		name: 'mcp_demo_message_len',
		clause: `CHECK (char_length(message) <= 500)`,
	},
];

const statements: string[] = [];

for (const c of CHECKS) {
	if (await hasConstraint(c.schema, c.table, c.name)) {
		console.log(`[skip] ${c.schema}.${c.table} ${c.name} already exists`);
	} else {
		statements.push(`ALTER TABLE ${c.schema}.${c.table} ADD CONSTRAINT ${c.name} ${c.clause}`);
	}
}

// DEFAULT '' on page_of_origin — SET DEFAULT is idempotent by nature.
statements.push(`ALTER TABLE feedback.feedback ALTER COLUMN page_of_origin SET DEFAULT ''`);

// last_used_at → timestamptz. Re-running is a no-op cast once converted; the
// probe keeps the log honest about whether anything changed.
const typeRes = await db.execute(sql`
	SELECT data_type FROM information_schema.columns
	WHERE table_schema = 'auth' AND table_name = 'passkey' AND column_name = 'last_used_at'
`);
const currentType = (typeRes.rows[0] as { data_type?: string } | undefined)?.data_type;
if (currentType === 'timestamp without time zone') {
	statements.push(
		`ALTER TABLE auth.passkey ALTER COLUMN last_used_at TYPE timestamptz USING last_used_at AT TIME ZONE 'UTC'`,
	);
} else {
	console.log(`[skip] auth.passkey.last_used_at is already '${currentType ?? 'missing'}'`);
}

if (statements.length === 0) {
	console.log('[ok] nothing to do — all backstops already in place');
	await pool.end();
	process.exit(0);
}

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

// Verify: count the constraints we now expect.
const verify = await db.execute(sql`
	SELECT n.nspname || '.' || t.relname AS tbl, c.conname AS name
	FROM pg_constraint c
	JOIN pg_class t ON t.oid = c.conrelid
	JOIN pg_namespace n ON n.oid = t.relnamespace
	WHERE c.conname IN (
		'feedback_subject_len', 'feedback_body_len', 'feedback_source_len',
		'mcp_demo_state_singleton', 'mcp_demo_color_allowed', 'mcp_demo_message_len'
	)
	ORDER BY 1, 2
`);
console.log('\n[verify] constraints present:');
for (const row of verify.rows) {
	const r = row as { tbl: string; name: string };
	console.log(`  ${r.tbl} — ${r.name}`);
}
console.log('[ok] constraint backstops applied');
await pool.end();
