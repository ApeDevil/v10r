import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Route queries over HTTP fetch instead of WebSocket.
// Bun's ws implementation mishandles WebSocket upgrade (HTTP 101).
// Same approach used in drizzle.config.ts.
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: env.NEON_DATABASE_URL_PROD });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
