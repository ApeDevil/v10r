import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '$lib/server/db/schema';

/**
 * Create a PGlite test database with the full schema.
 * Uses drizzle-kit's programmatic push to generate DDL, then executes
 * with search_path set so unqualified enum references resolve.
 */
export async function createTestDb() {
	const client = new PGlite({ extensions: { vector } });
	await client.exec('CREATE EXTENSION IF NOT EXISTS vector');
	const db = drizzle(client, { schema });

	// Get DDL statements from drizzle-kit push (don't call apply — it fails on unqualified enums)
	// biome-ignore lint/suspicious/noExplicitAny: PGlite db type doesn't match pushSchema's strict PgDatabase generic
	const { statementsToExecute } = await pushSchema(schema, db as any);

	// Execute schema creation first, then set search_path, then the rest
	const schemaStmts = statementsToExecute.filter((s) => s.startsWith('CREATE SCHEMA'));
	const otherStmts = statementsToExecute.filter((s) => !s.startsWith('CREATE SCHEMA'));

	for (const stmt of schemaStmts) {
		await client.exec(stmt);
	}

	// Add all custom schemas to search_path so unqualified enum references resolve
	await client.exec(
		'SET search_path TO public, admin, ai, analytics, app, auth, blog, desk, jobs, notifications, rag, showcase',
	);

	for (const stmt of otherStmts) {
		await client.exec(stmt);
	}

	return { db, client };
}
