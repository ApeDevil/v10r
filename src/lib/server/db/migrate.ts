import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';

// Route queries over HTTP fetch — Bun's ws mishandles WebSocket upgrade (HTTP 101).
neonConfig.poolQueryViaFetch = true;

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

try {
	console.log('Running migrations...');
	await migrate(db, { migrationsFolder: './drizzle' });
	console.log('Migrations complete');
	process.exit(0);
} catch (err) {
	console.error('Migration failed:', err);
	process.exit(1);
}
