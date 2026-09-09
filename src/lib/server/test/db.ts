import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import type { Logger } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { inject } from 'vitest';
import * as schema from '$lib/server/db/schema';

/**
 * `logger` is the seam the query-budget gate needs: the production `db` wires the
 * query census in through it, and a test database that dropped it would count nothing.
 * Every other caller leaves it off and gets Drizzle's silent default.
 */
export interface TestDbOptions {
	logger?: Logger;
}

/**
 * A test database with the full schema already in it.
 *
 * The schema is built once per run by `pglite-schema.setup.ts` (the `db` project's
 * globalSetup) and restored here from a datadir dump. Restoring costs ~294 ms against
 * ~1,435 ms to build it from scratch, because the dump skips PGlite's `initdb` — which
 * measured 59% of the old per-file cost. `extensions` must still be supplied on restore:
 * the dump carries the extension's data, not its registration.
 *
 * The fallback below builds from scratch, for `bunx vitest run <one file>` invocations
 * that bypass the `db` project and so never ran globalSetup. It warns rather than throws,
 * because that invocation is the documented single-file workflow — but it warns loudly,
 * since silently paying the old cost is the failure mode that would make this look like
 * it accomplished nothing.
 */
async function buildFromScratch({ logger }: TestDbOptions) {
	const client = new PGlite({ extensions: { vector } });
	await client.exec('CREATE EXTENSION IF NOT EXISTS vector');
	const db = drizzle(client, { schema, logger });

	// Dynamic on purpose: `drizzle-kit/api` drags esbuild in, and no worker on the
	// restore path should pay to resolve and transform that.
	const { pushSchema } = await import('drizzle-kit/api');
	// biome-ignore lint/suspicious/noExplicitAny: PGlite db type doesn't match pushSchema's strict PgDatabase generic
	const { statementsToExecute } = await pushSchema(schema, db as any);

	const schemaStmts = statementsToExecute.filter((s) => s.startsWith('CREATE SCHEMA'));
	for (const stmt of schemaStmts) await client.exec(stmt);

	// Unqualified enum references in the generated DDL resolve through search_path, so every
	// namespace must be on it. Derived from the CREATE SCHEMA statements rather than listed:
	// the hand-kept list went stale twice (it still named `app` and `rag` after both were
	// renamed) and the symptom was a type-does-not-exist error far from the cause.
	const namespaces = schemaStmts
		.map((stmt) => /CREATE SCHEMA (?:IF NOT EXISTS )?"?(\w+)"?/.exec(stmt)?.[1])
		.filter((name): name is string => Boolean(name));
	await client.exec(`SET search_path TO public, ${namespaces.join(', ')}`);

	for (const stmt of statementsToExecute.filter((s) => !s.startsWith('CREATE SCHEMA'))) {
		await client.exec(stmt);
	}
	return { db, client };
}

export async function createTestDb(options: TestDbOptions = {}) {
	let dumpPath: string | undefined;
	let searchPath: string | undefined;
	try {
		dumpPath = inject('pgliteSchemaDump');
		searchPath = inject('pgliteSearchPath');
	} catch {
		// `inject` throws outside a worker that ran globalSetup.
	}

	if (!dumpPath || !searchPath) {
		console.warn('[createTestDb] no schema snapshot injected — rebuilding from scratch (~5x slower)');
		return buildFromScratch(options);
	}

	const client = new PGlite({
		loadDataDir: new Blob([readFileSync(dumpPath)]),
		extensions: { vector },
	});
	// search_path is session state and does not travel in the dump.
	await client.exec(`SET search_path TO ${searchPath}`);
	return { db: drizzle(client, { schema, logger: options.logger }), client };
}
