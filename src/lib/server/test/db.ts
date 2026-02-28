import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '$lib/server/db/schema';

export async function createTestDb() {
	const client = new PGlite({ extensions: { vector } });
	await client.exec('CREATE EXTENSION IF NOT EXISTS vector');
	const db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder: './drizzle' });
	return { db, client };
}
