#!/usr/bin/env bun
/**
 * One-off / idempotent: reconcile Neon's `mcp` schema with the code schema before the
 * `/api/mcp/private` surface ships.
 *
 * WHY: Neon carries leftover DDL from a DISCARDED branch (2026-08-03): an extra `'local'` value
 * on `mcp.mcp_surface`, a `workspace` column, a handful of test rows with `surface='local'`, and
 * possibly indexes/CHECKs the code schema never declared. The code schema now wants the enum to
 * be ('public','admin','private') plus `workspace` and `response_text` columns. PostgreSQL cannot
 * DROP a value from an enum, so drizzle-kit would emit a destructive drop-and-recreate and stall
 * on an interactive prompt this container cannot answer — hence this script (same pattern as
 * collapse-consent-tier.ts).
 *
 * WHAT IT DOES (one transaction):
 *   1. DELETE the discarded-branch rows (`surface = 'local'`) while the old type still has the value.
 *   2. Defensively null any workspace/response_text values that would violate the new CHECKs.
 *   3. DROP every CHECK constraint on mcp.call_log — the enum retype below re-binds dependent
 *      expressions and can fail against the old type's OID, and `db:push` is the authority on the
 *      re-rendered expressions anyway (a hand-written variant risks a permanent diff).
 *   4. DROP indexes the code schema does not declare (v1 leftovers), including any stale
 *      mcp_call_workspace_idx — push recreates it from the declaration.
 *   5. Swap the enum: rename aside → create ('public','admin','private') → retype the column with
 *      an explicit USING cast → drop the old type.
 *   6. ADD COLUMN IF NOT EXISTS workspace / response_text.
 *
 * THEN STOP. The follow-up `bun run db:push` re-adds all CHECKs and the workspace index; its plan
 * must be purely additive (ADD CONSTRAINT / CREATE INDEX) — anything destructive there means this
 * script did not finish its job. Abort the push in that case, extend this script instead.
 *
 * DRY RUN BY DEFAULT (this script deletes rows — a deviation from the other db one-offs, on
 * purpose). Run with `--apply` to execute:
 *
 *   bun run scripts/db/reconcile-mcp-private-surface.ts           # print the plan
 *   bun run scripts/db/reconcile-mcp-private-surface.ts --apply   # execute it
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.poolQueryViaFetch = true;

const APPLY = process.argv.includes('--apply');

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

const TARGET_ENUM = ['public', 'admin', 'private'];

/** Indexes the CODE schema declares (plus the pkey) — everything else on the table is dropped as
 *  a discarded-branch leftover. `mcp_call_workspace_idx` is declared, so a post-push re-run of
 *  this script correctly reports "already reconciled" instead of planning to drop it. (The
 *  applied 2026-08-03 one-shot ran with a stricter list that also replaced the v1 index of the
 *  same name; if a definition ever drifts, `db:push` reports the diff.) */
const KEEP_INDEXES = new Set([
	'call_log_pkey',
	'mcp_call_started_idx',
	'mcp_call_tool_idx',
	'mcp_call_miss_idx',
	'mcp_call_subject_idx',
	'mcp_call_trace_idx',
	'mcp_call_workspace_idx',
]);

/** Every column the CODE schema declares (snake_case). Anything else on Neon is a discarded-branch
 *  leftover (v1 had e.g. `session_key`) and must go HERE — left in place, the next `db:push`
 *  proposes a destructive DROP COLUMN and stalls on an interactive prompt. */
const DECLARED_COLUMNS = new Set([
	'id',
	'surface',
	'traffic',
	'stage',
	'outcome',
	'method',
	'tool_name',
	'subject',
	'query_text',
	'response_text',
	'workspace',
	'requested_protocol_version',
	'served_protocol_version',
	'rc_headers',
	'client_family',
	'client_name',
	'client_version',
	'trace_id',
	'client_key',
	'registry_version',
	'observed_count',
	'total_ms',
	'gate_ms',
	'dispatch_ms',
	'started_at',
]);

async function enumValues(): Promise<string[]> {
	const res = await db.execute(sql`
		SELECT e.enumlabel AS label
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typname = 'mcp_surface' AND n.nspname = 'mcp'
		ORDER BY e.enumsortorder
	`);
	return res.rows.map((r) => (r as { label: string }).label);
}

async function columns(): Promise<Map<string, { default: string | null }>> {
	const res = await db.execute(sql`
		SELECT column_name, column_default
		FROM information_schema.columns
		WHERE table_schema = 'mcp' AND table_name = 'call_log'
	`);
	return new Map(
		res.rows.map((r) => {
			const row = r as { column_name: string; column_default: string | null };
			return [row.column_name, { default: row.column_default }];
		}),
	);
}

async function checkConstraints(): Promise<Array<{ name: string; def: string }>> {
	const res = await db.execute(sql`
		SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS def
		FROM pg_constraint c
		JOIN pg_class t ON t.oid = c.conrelid
		JOIN pg_namespace n ON n.oid = t.relnamespace
		WHERE n.nspname = 'mcp' AND t.relname = 'call_log' AND c.contype = 'c'
		ORDER BY c.conname
	`);
	return res.rows.map((r) => r as { name: string; def: string });
}

async function indexes(): Promise<Array<{ name: string; def: string }>> {
	const res = await db.execute(sql`
		SELECT indexname AS name, indexdef AS def
		FROM pg_indexes
		WHERE schemaname = 'mcp' AND tablename = 'call_log'
		ORDER BY indexname
	`);
	return res.rows.map((r) => r as { name: string; def: string });
}

// ── Probes ───────────────────────────────────────────────────────────────────

const values = await enumValues();
if (values.length === 0) {
	console.error('[fail] mcp.mcp_surface does not exist — run db:push first');
	await pool.end();
	process.exit(1);
}
console.log(`[probe] mcp_surface values: ${values.join(', ')}`);

const cols = await columns();
console.log(
	`[probe] columns: workspace=${cols.has('workspace')} response_text=${cols.has('response_text')} surface default=${cols.get('surface')?.default ?? 'none'}`,
);

const checks = await checkConstraints();
console.log(`[probe] ${checks.length} CHECK constraint(s): ${checks.map((c) => c.name).join(', ') || '(none)'}`);

const idx = await indexes();
const leftoverIdx = idx.filter((i) => !KEEP_INDEXES.has(i.name));
console.log(`[probe] indexes: ${idx.map((i) => i.name).join(', ')}`);
if (leftoverIdx.length > 0)
	console.log(`[probe] leftover indexes to drop: ${leftoverIdx.map((i) => i.name).join(', ')}`);

const leftoverCols = [...cols.keys()].filter((c) => !DECLARED_COLUMNS.has(c));
if (leftoverCols.length > 0) console.log(`[probe] leftover columns to drop: ${leftoverCols.join(', ')}`);

const counts = await db.execute(sql`SELECT surface::text AS surface, count(*)::int AS n FROM mcp.call_log GROUP BY 1`);
for (const r of counts.rows as Array<{ surface: string; n: number }>) {
	console.log(`[probe] rows: surface=${r.surface} n=${r.n}`);
}
const localRows = (counts.rows as Array<{ surface: string; n: number }>).find((r) => r.surface === 'local')?.n ?? 0;

const enumOk = values.length === TARGET_ENUM.length && TARGET_ENUM.every((v, i) => values[i] === v);
if (
	enumOk &&
	cols.has('workspace') &&
	cols.has('response_text') &&
	localRows === 0 &&
	leftoverIdx.length === 0 &&
	leftoverCols.length === 0
) {
	console.log('[skip] already reconciled — nothing to do. Next: bun run db:push');
	await pool.end();
	process.exit(0);
}

// ── Plan ─────────────────────────────────────────────────────────────────────

const statements: string[] = [];

// 1. Discarded-branch rows go first, while the old type still accepts 'local'.
if (localRows > 0) statements.push(`DELETE FROM mcp.call_log WHERE surface::text = 'local'`);

// 2. Defensive: survivors must satisfy the CHECKs push is about to add. (Expected no-ops —
//    workspace only ever had values on the deleted rows, response_text does not exist yet.)
if (cols.has('workspace')) {
	statements.push(
		`UPDATE mcp.call_log SET workspace = NULL WHERE workspace IS NOT NULL AND surface::text <> 'private'`,
	);
}
if (cols.has('response_text')) {
	statements.push(`UPDATE mcp.call_log SET response_text = NULL WHERE response_text IS NOT NULL`);
}

// 3. Every CHECK goes: the retype below re-binds dependent expressions (surface-referencing ones
//    would break), and push re-adds the full declared set afterwards — the boring plan.
for (const c of checks) {
	statements.push(`ALTER TABLE mcp.call_log DROP CONSTRAINT IF EXISTS ${c.name}`);
}

// 4. Leftover indexes and columns the code schema does not declare. Columns after CHECKs (a
//    leftover CHECK may reference a leftover column) and after their indexes.
for (const i of leftoverIdx) {
	statements.push(`DROP INDEX IF EXISTS mcp.${i.name}`);
}
for (const c of leftoverCols) {
	statements.push(`ALTER TABLE mcp.call_log DROP COLUMN IF EXISTS ${c}`);
}

// 5. The enum swap (collapse-consent-tier.ts pattern). `surface` has no DEFAULT in the code
//    schema; if a leftover default exists it must be dropped before the retype.
if (!enumOk) {
	if (cols.get('surface')?.default) statements.push(`ALTER TABLE mcp.call_log ALTER COLUMN surface DROP DEFAULT`);
	statements.push(`ALTER TYPE mcp.mcp_surface RENAME TO mcp_surface_old`);
	statements.push(`CREATE TYPE mcp.mcp_surface AS ENUM ('public', 'admin', 'private')`);
	statements.push(
		`ALTER TABLE mcp.call_log ALTER COLUMN surface TYPE mcp.mcp_surface USING surface::text::mcp.mcp_surface`,
	);
	statements.push(`DROP TYPE mcp.mcp_surface_old`);
}

// 6. Columns the code schema now declares.
statements.push(`ALTER TABLE mcp.call_log ADD COLUMN IF NOT EXISTS workspace text`);
statements.push(`ALTER TABLE mcp.call_log ADD COLUMN IF NOT EXISTS response_text text`);

console.log(`\n[plan] ${statements.length} statement(s):`);
for (const stmt of statements) console.log(`  • ${stmt}`);

if (!APPLY) {
	console.log('\n[dry-run] nothing executed. Re-run with --apply to execute.');
	await pool.end();
	process.exit(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────

console.log(`\n[run] applying in one transaction…`);
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

console.log(`\n[verify] mcp_surface values: ${(await enumValues()).join(', ')}`);
const colsAfter = await columns();
console.log(`[verify] workspace=${colsAfter.has('workspace')} response_text=${colsAfter.has('response_text')}`);
console.log(`[verify] CHECKs remaining: ${(await checkConstraints()).length} (push re-adds the declared set)`);
console.log('[ok] reconciled. Next: bun run db:push — expect ONLY ADD CONSTRAINT / CREATE INDEX.');
console.log('     If the push plan proposes anything destructive, ABORT and extend this script.');
await pool.end();
