/**
 * One-time: `ALTER SCHEMA rag RENAME TO retrieval`.
 *
 * Why a script rather than `db:push`: drizzle-kit cannot express a schema RENAME. It sees
 * `rag` gone and `retrieval` new, and offers to DROP and CREATE — which would destroy every
 * document, chunk and embedding in it. `ALTER SCHEMA … RENAME` is a single catalog update
 * that carries the tables, indexes, constraints and enums across with their data intact.
 *
 * Idempotent: if `retrieval` already exists and `rag` does not, it reports and exits 0, so
 * a re-run after a partial deploy is safe.
 *
 * Run this BEFORE `db:push` on any database still on the old name. Afterwards `db:push`
 * must report no changes for this namespace; if it wants to create or drop anything in
 * `retrieval`, stop and investigate rather than accepting.
 *
 *   podman exec v10r bun run db:rename-rag-schema
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

try {
	const hasOld = await schemaExists('rag');
	const hasNew = await schemaExists('retrieval');

	if (!hasOld && hasNew) {
		console.log('Already renamed — `retrieval` exists and `rag` does not. Nothing to do.');
	} else if (!hasOld && !hasNew) {
		console.error('Neither `rag` nor `retrieval` exists. Refusing to guess — run db:push on a fresh database instead.');
		process.exit(1);
	} else if (hasOld && hasNew) {
		console.error('BOTH `rag` and `retrieval` exist. A previous run was interrupted, or the new schema was');
		console.error('created empty by a db:push. Inspect both and merge by hand — this script will not choose.');
		process.exit(1);
	} else {
		const { rows } = await pool.query(
			"SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'rag'",
		);
		console.log(`Renaming schema rag → retrieval (${rows[0].tables} tables)…`);
		await pool.query('ALTER SCHEMA rag RENAME TO retrieval');
		console.log('Done. Now run `db:push` — it must report no changes for this namespace.');
	}
} finally {
	await pool.end();
}
