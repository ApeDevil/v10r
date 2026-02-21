import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { DATABASE_URL } from '$env/static/private';
import ws from 'ws';
import * as schema from './schema';

// Node/Bun need a WebSocket polyfill for Neon's serverless driver
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool, { schema });
