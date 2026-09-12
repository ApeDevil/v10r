import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle, type NeonQueryResultHKT } from 'drizzle-orm/neon-serverless';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { env } from '$env/dynamic/private';
import { queryCensusLogger } from './query-census';
import * as schema from './schema';

// Route queries over HTTP fetch instead of WebSocket.
// Bun's ws implementation mishandles WebSocket upgrade (HTTP 101).
// Same approach used in drizzle.config.ts.
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: env.NEON_DATABASE_URL_PROD });

// `logger` is not logging — it is the only seam Drizzle offers that sees every
// statement from every domain, including Better Auth's. It counts round trips into
// whatever census is in scope and does nothing at all when none is.
export const db = drizzle(pool, { schema, logger: queryCensusLogger });

export type Database = typeof db;

/**
 * What a domain mutation runs on: the database itself, or the transaction a caller
 * already holds. `PgTransaction` extends `PgDatabase`, so a `handle.transaction(...)`
 * inside a mutation nests as a SAVEPOINT when the caller passed its transaction and
 * opens a real one otherwise — the mutation's body is the same either way. This is
 * how a proposal step's desk mutation and its receipt commit together.
 */
export type DbHandle = PgDatabase<NeonQueryResultHKT, typeof schema>;
