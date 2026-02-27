import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { DATABASE_URL } from '$env/static/private';
import * as schema from './schema';

// Route queries over HTTP fetch instead of WebSocket.
// Bun's ws implementation mishandles WebSocket upgrade (HTTP 101).
// Same approach used in drizzle.config.ts.
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool, { schema });
