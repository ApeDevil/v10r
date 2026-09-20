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
 * A single-file `bunx vitest run <file>` still runs the project's globalSetup, so the
 * snapshot is always injected; a missing one means the file is not in the `db` project
 * (a `*.pglite.test.ts` name is what routes it there), which is worth failing loudly.
 */
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
		throw new Error(
			'[createTestDb] no schema snapshot injected — is this file in the `db` vitest project (*.pglite.test.ts)?',
		);
	}

	const client = new PGlite({
		loadDataDir: new Blob([readFileSync(dumpPath)]),
		extensions: { vector },
	});
	// search_path is session state and does not travel in the dump.
	await client.exec(`SET search_path TO ${searchPath}`);
	return { db: drizzle(client, { schema, logger: options.logger }), client };
}
