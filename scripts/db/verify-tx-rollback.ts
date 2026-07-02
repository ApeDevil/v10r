#!/usr/bin/env bun
/**
 * Neon transaction rollback probe.
 *
 * Verifies that drizzle's `db.transaction()` actually rolls back (and commits) under the
 * Bun dev container's neon-serverless driver with `poolQueryViaFetch = true`. Production
 * runs Node on Vercel where WebSocket transactions are known-good; this closes the ONE
 * environment (Bun + fetch-routed pool) that the pglite-based unit tests cannot exercise,
 * despite the codebase having 22 `db.transaction()` call sites.
 *
 * Safe: creates a throwaway scratch table, exercises rollback + commit, then drops it.
 * Touches no real data. Targets NEON_DATABASE_URL_PROD (the same var the app uses).
 *
 * Run:
 *   podman exec v10r bun run scripts/db/verify-tx-rollback.ts
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD is not set');
	process.exit(1);
}

// Mirror src/lib/server/db/index.ts exactly so the probe exercises the real driver path.
neonConfig.poolQueryViaFetch = true;
const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

const SCRATCH = sql.raw('public._tx_rollback_probe');
const marker = `probe-${Date.now()}`;
const commitMarker = `${marker}-commit`;

async function main() {
	await db.execute(sql`CREATE TABLE IF NOT EXISTS ${SCRATCH} (marker text)`);

	// 1) Rollback path — a tx that throws must leave NO row behind.
	let threw = false;
	try {
		await db.transaction(async (tx) => {
			await tx.execute(sql`INSERT INTO ${SCRATCH} (marker) VALUES (${marker})`);
			throw new Error('intentional rollback');
		});
	} catch {
		threw = true;
	}
	const afterRollback = await db.execute(sql`SELECT marker FROM ${SCRATCH} WHERE marker = ${marker}`);
	const rolledBack = afterRollback.rows.length === 0;

	// 2) Commit path (control) — a tx that returns normally must persist its row.
	await db.transaction(async (tx) => {
		await tx.execute(sql`INSERT INTO ${SCRATCH} (marker) VALUES (${commitMarker})`);
	});
	const afterCommit = await db.execute(sql`SELECT marker FROM ${SCRATCH} WHERE marker = ${commitMarker}`);
	const committed = afterCommit.rows.length === 1;

	await db.execute(sql`DROP TABLE IF EXISTS ${SCRATCH}`);
	await pool.end();

	console.log(`  tx threw as expected:      ${threw}`);
	console.log(`  rollback removed the row:  ${rolledBack}`);
	console.log(`  commit persisted the row:  ${committed}`);

	if (threw && rolledBack && committed) {
		console.log('\n✅ db.transaction() rollback + commit are both correct under this runtime.');
		process.exit(0);
	}
	console.error('\n❌ Transaction semantics are WRONG under this runtime — db.transaction() is unsafe here.');
	process.exit(2);
}

main().catch((e) => {
	console.error('Probe failed:', e);
	process.exit(1);
});
