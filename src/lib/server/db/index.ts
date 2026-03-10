import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { DATABASE_URL } from '$env/static/private';
import * as schema from './schema';
import * as relations from './schema/relations';

// Route queries over HTTP fetch instead of WebSocket.
// Bun's ws implementation mishandles WebSocket upgrade (HTTP 101).
// Same approach used in drizzle.config.ts.
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool, { schema: { ...schema, ...relations } });

export type Database = typeof db;
