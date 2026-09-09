import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import type { TestProject } from 'vitest/node';
import * as schema from '../db/schema';

/**
 * Build the test database ONCE per run and hand every worker a snapshot to restore.
 *
 * Measured cost of the old per-file path (80 tables, 15 namespaces, 415 DDL statements):
 *
 *   PGlite initdb            840 ms   ← the real cost
 *   CREATE EXTENSION vector   26 ms
 *   import drizzle-kit/api   221 ms   (drags esbuild into every worker)
 *   pushSchema (diff)         61 ms
 *   DDL replay (415 execs)   287 ms
 *   ────────────────────────────────
 *   total                  1,435 ms   × 26 files
 *
 * Restoring a datadir dump is 294 ms, so the snapshot skips `initdb` — which is 59% of
 * that total and the part no amount of hoisting could remove. Hoisting only `pushSchema`
 * would have saved 4%.
 *
 * globalSetup runs before any worker exists and in a different global scope, so a live
 * PGlite handle cannot be passed down; `provide()` carries structured-clone data only.
 * The dump is ~33 MB, which is too much to push through IPC 26 times — so it goes to a
 * file and workers are given the path.
 *
 * The dump is written to the OS temp dir, never the repo: datadir dumps are not portable
 * across PGlite versions, so a stale one must be impossible to commit or to reuse after
 * an upgrade. It is rebuilt every run for the same reason.
 */
export default async function setup(project: TestProject) {
	const client = new PGlite({ extensions: { vector } });
	try {
		await client.exec('CREATE EXTENSION IF NOT EXISTS vector');
		const db = drizzle(client, { schema });
		// biome-ignore lint/suspicious/noExplicitAny: PGlite db type doesn't match pushSchema's strict PgDatabase generic
		const { statementsToExecute } = await pushSchema(schema, db as any);

		// Same ordering as the per-file path used to do: schemas first, then search_path
		// derived from them (so unqualified enum references resolve), then everything else.
		const schemaStmts = statementsToExecute.filter((s) => s.startsWith('CREATE SCHEMA'));
		for (const stmt of schemaStmts) await client.exec(stmt);

		const namespaces = schemaStmts
			.map((stmt) => /CREATE SCHEMA (?:IF NOT EXISTS )?"?(\w+)"?/.exec(stmt)?.[1])
			.filter((name): name is string => Boolean(name));
		await client.exec(`SET search_path TO public, ${namespaces.join(', ')}`);

		for (const stmt of statementsToExecute.filter((s) => !s.startsWith('CREATE SCHEMA'))) {
			await client.exec(stmt);
		}

		const dir = join(tmpdir(), 'v10r-pglite');
		mkdirSync(dir, { recursive: true });
		const path = join(dir, `schema-${process.pid}.tar`);
		writeFileSync(path, Buffer.from(await (await client.dumpDataDir('none')).arrayBuffer()));

		project.provide('pgliteSchemaDump', path);
		project.provide('pgliteSearchPath', `public, ${namespaces.join(', ')}`);

		// Vitest keeps the dump alive until every db worker has exited, then calls this
		// teardown. The dev container is long-lived, so omitting it would leak ~33 MB under
		// /tmp on every test run (the PID-based filename deliberately changes each run).
		return () => rmSync(path, { force: true });
	} finally {
		await client.close();
	}
}
