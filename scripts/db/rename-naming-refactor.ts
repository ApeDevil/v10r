/**
 * One-time DDL for the naming-integrity refactor: the renames `db:push` cannot express.
 *
 * drizzle-kit sees a rename as a DROP plus a CREATE. For a schema that is fine only when
 * it is empty; here it would destroy user preferences, custom palettes and the branch-
 * operation ledger. `ALTER … RENAME` is a catalog update that carries data, indexes and
 * constraints across untouched.
 *
 * Three renames, each guarded and idempotent — a partial run is safe to repeat:
 *   1. schema  `app`            → `personalization`  (user_preferences, custom_palettes)
 *   2. table   `dbops.run`      → `dbops.operation`  (+ its five indexes)
 *   3. enums   `dbops_run_*`    → `dbops_operation_*`
 *
 * Run BEFORE `db:push`. Afterwards push must report no changes for these namespaces; if it
 * offers to create or drop anything here, stop and investigate rather than accepting.
 *
 *   podman exec v10r bun run db:rename-naming-refactor
 */
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.poolQueryViaFetch = true;

const connectionString = process.env.NEON_DATABASE_URL_PROD;
if (!connectionString) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString });

async function schemaExists(name: string): Promise<boolean> {
	const { rows } = await pool.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [name]);
	return rows.length > 0;
}

async function tableExists(schema: string, name: string): Promise<boolean> {
	const { rows } = await pool.query(
		'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
		[schema, name],
	);
	return rows.length > 0;
}

async function typeExists(schema: string, name: string): Promise<boolean> {
	const { rows } = await pool.query(
		`SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
		 WHERE n.nspname = $1 AND t.typname = $2`,
		[schema, name],
	);
	return rows.length > 0;
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
	['dbops_run_created_idx', 'dbops_operation_created_idx'],
	['dbops_run_status_idx', 'dbops_operation_status_idx'],
	['dbops_run_active_unique_idx', 'dbops_operation_active_unique_idx'],
	['dbops_run_idem_unique_idx', 'dbops_operation_idem_unique_idx'],
	['dbops_run_lease_idx', 'dbops_operation_lease_idx'],
];

let ok = true;
try {
	console.log('1. schema app → personalization');
	ok =
		(await renameGuarded(
			'app → personalization',
			await schemaExists('app'),
			await schemaExists('personalization'),
			'ALTER SCHEMA app RENAME TO personalization',
		)) && ok;

	console.log('2. table dbops.run → dbops.operation');
	if (await schemaExists('dbops')) {
		ok =
			(await renameGuarded(
				'dbops.run → dbops.operation',
				await tableExists('dbops', 'run'),
				await tableExists('dbops', 'operation'),
				'ALTER TABLE dbops.run RENAME TO operation',
			)) && ok;

		for (const [from, to] of INDEX_RENAMES) {
			const { rows } = await pool.query('SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2', [
				'dbops',
				from,
			]);
			if (rows.length > 0) {
				await pool.query(`ALTER INDEX dbops.${from} RENAME TO ${to}`);
				console.log(`  index ${from} → ${to}: renamed.`);
			}
		}

		console.log('3. enums dbops_run_* → dbops_operation_*');
		for (const kind of ['status', 'kind', 'trigger']) {
			ok =
				(await renameGuarded(
					`dbops_run_${kind} → dbops_operation_${kind}`,
					await typeExists('dbops', `dbops_run_${kind}`),
					await typeExists('dbops', `dbops_operation_${kind}`),
					`ALTER TYPE dbops.dbops_run_${kind} RENAME TO dbops_operation_${kind}`,
				)) && ok;
		}
	} else {
		console.log('  dbops schema absent — nothing to rename. db:push will create it under the new names.');
	}
} finally {
	await pool.end();
}

if (!ok) process.exit(1);
console.log('\nDone. Now run `db:push` — it must report no changes for app/personalization or dbops.');
