/**
 * One-time DDL for the turn-trace refactor: the renames `db:push` cannot express.
 *
 * drizzle-kit sees a rename as a DROP plus a CREATE, which would discard the usage rows the
 * admin cost/usage views read. `ALTER … RENAME` is a catalog update that carries data,
 * indexes and constraints across untouched. Each step is guarded and idempotent — a partial
 * run is safe to repeat:
 *   1. table  `ai.conversation_step` → `ai.model_call`  (+ its four indexes)
 *   2. column `ai.tool_call.tool_call_id`: added and backfilled from `id`, so push can make it
 *      NOT NULL without prompting over existing rows
 *   3. enum   `ai.tool_call_status`: `pending` (never persisted) leaves, `requires_approval`
 *      arrives — a value removal push cannot do in place
 *
 * Everything else — the new `ai.turn` table, `message.parts`, the dropped `step_type` /
 * `retrieval_events` / `tool_call_ids` / `message.context` columns, the new `model_call` and
 * `tool_call` columns — is push's job. Run this BEFORE `db:push`; afterwards push must offer
 * nothing for `conversation_step` and no rename prompt. If it offers to create `model_call`
 * or drop `conversation_step`, stop and investigate rather than accepting.
 *
 *   podman exec v10r bun run db:rename-conversation-step
 */
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.poolQueryViaFetch = true;

const connectionString = process.env.NEON_DATABASE_URL_PROD;
if (!connectionString) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString });

async function tableExists(schema: string, name: string): Promise<boolean> {
	const { rows } = await pool.query(
		'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
		[schema, name],
	);
	return rows.length > 0;
}

async function columnExists(schema: string, table: string, column: string): Promise<boolean> {
	const { rows } = await pool.query(
		'SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3',
		[schema, table, column],
	);
	return rows.length > 0;
}

async function enumLabels(schema: string, name: string): Promise<string[] | null> {
	const { rows } = await pool.query<{ label: string }>(
		`SELECT e.enumlabel AS label FROM pg_enum e
		 JOIN pg_type t ON t.oid = e.enumtypid
		 JOIN pg_namespace n ON n.oid = t.typnamespace
		 WHERE n.nspname = $1 AND t.typname = $2
		 ORDER BY e.enumsortorder`,
		[schema, name],
	);
	return rows.length > 0 ? rows.map((r) => r.label) : null;
}

/** Rename `from` → `to` when only `from` exists; refuse when both do. */
async function renameGuarded(label: string, hasFrom: boolean, hasTo: boolean, ddl: string): Promise<boolean> {
	if (!hasFrom && hasTo) {
		console.log(`  ${label}: already renamed.`);
		return true;
	}
	if (!hasFrom && !hasTo) {
		console.error(`  ${label}: neither name exists. Refusing to guess — run db:push on a fresh database instead.`);
		return false;
	}
	if (hasFrom && hasTo) {
		console.error(`  ${label}: BOTH names exist. A previous run was interrupted, or a db:push created the new`);
		console.error('    one empty. Inspect both and merge by hand — this script will not choose.');
		return false;
	}
	await pool.query(ddl);
	console.log(`  ${label}: renamed.`);
	return true;
}

const INDEX_RENAMES: Array<[string, string]> = [
	['conv_step_conv_msg_idx', 'model_call_conv_msg_idx'],
	['conv_step_model_idx', 'model_call_model_idx'],
	['conv_step_provider_idx', 'model_call_provider_idx'],
	['conv_step_surface_idx', 'model_call_surface_idx'],
];

const TOOL_CALL_STATUS_LABELS = ['success', 'error', 'requires_approval'];

let ok = true;
try {
	console.log('1. table ai.conversation_step → ai.model_call');
	ok =
		(await renameGuarded(
			'ai.conversation_step → ai.model_call',
			await tableExists('ai', 'conversation_step'),
			await tableExists('ai', 'model_call'),
			'ALTER TABLE ai.conversation_step RENAME TO model_call',
		)) && ok;

	for (const [from, to] of INDEX_RENAMES) {
		const { rows } = await pool.query('SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2', [
			'ai',
			from,
		]);
		if (rows.length > 0) {
			await pool.query(`ALTER INDEX ai.${from} RENAME TO ${to}`);
			console.log(`  index ${from} → ${to}: renamed.`);
		}
	}

	console.log('2. column ai.tool_call.tool_call_id (backfilled from id)');
	if (await tableExists('ai', 'tool_call')) {
		if (await columnExists('ai', 'tool_call', 'tool_call_id')) {
			console.log('  already present.');
		} else {
			await pool.query('ALTER TABLE ai.tool_call ADD COLUMN tool_call_id text');
			console.log('  added.');
		}
		// Rows written before the SDK id was recorded carry their own id as the call id — a
		// stable, unique stand-in that satisfies NOT NULL without inventing a provider id.
		const { rowCount } = await pool.query('UPDATE ai.tool_call SET tool_call_id = id WHERE tool_call_id IS NULL');
		console.log(`  backfilled ${rowCount ?? 0} row(s).`);
	} else {
		console.log('  ai.tool_call absent — nothing to backfill. db:push will create it.');
	}

	console.log('3. enum ai.tool_call_status: − pending, + requires_approval');
	const labels = await enumLabels('ai', 'tool_call_status');
	if (!labels) {
		console.log('  enum absent — db:push will create it.');
	} else if (labels.join(',') === TOOL_CALL_STATUS_LABELS.join(',')) {
		console.log('  already current.');
	} else {
		// A `pending` row is a tool call whose turn never finished writing; there are none by
		// construction now (rows are written once, at the end of the turn) — count them anyway.
		const { rowCount } = await pool.query("UPDATE ai.tool_call SET status = 'error' WHERE status = 'pending'");
		if (rowCount) console.log(`  ${rowCount} pending row(s) marked error.`);
		await pool.query('ALTER TYPE ai.tool_call_status RENAME TO tool_call_status_old');
		await pool.query(
			`CREATE TYPE ai.tool_call_status AS ENUM (${TOOL_CALL_STATUS_LABELS.map((l) => `'${l}'`).join(', ')})`,
		);
		await pool.query('ALTER TABLE ai.tool_call ALTER COLUMN status DROP DEFAULT');
		await pool.query(
			'ALTER TABLE ai.tool_call ALTER COLUMN status TYPE ai.tool_call_status USING status::text::ai.tool_call_status',
		);
		await pool.query('DROP TYPE ai.tool_call_status_old');
		console.log('  recreated.');
	}
} finally {
	await pool.end();
}

if (!ok) process.exit(1);
console.log('\nDone. Now run `db:push` — it must offer nothing for ai.conversation_step and no rename prompt.');
