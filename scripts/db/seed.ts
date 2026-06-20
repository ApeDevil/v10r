/**
 * Seed runner — opens its own Pool (not via $env, since this runs outside
 * the SvelteKit runtime) and calls runSeed.
 *
 *   podman exec v10r bun run scripts/db/seed.ts
 *   bun run db:seed
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../src/lib/server/db/schema';
import * as relations from '../../src/lib/server/db/schema/relations';
import { runSeed } from '../../src/lib/server/db/seed';

neonConfig.poolQueryViaFetch = true;

const NEON_DATABASE_URL_PROD = process.env.NEON_DATABASE_URL_PROD;
if (!NEON_DATABASE_URL_PROD) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: NEON_DATABASE_URL_PROD });
const db = drizzle(pool, { schema: { ...schema, ...relations } });

try {
	await runSeed(db);
	console.log('[seed] OK');
} catch (err) {
	console.error('[seed] FAILED:', err);
	process.exitCode = 1;
} finally {
	await pool.end();
}
