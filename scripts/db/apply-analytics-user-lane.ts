#!/usr/bin/env bun
/**
 * One-off / idempotent: apply the additive analytics schema for the two-lane
 * model — `analytics.user_surface`, `analytics.user_events`, and the new
 * `analytics.events.route` column plus its indexes.
 *
 * WHY THIS EXISTS RATHER THAN JUST `db:push`: drizzle-kit cannot tell a NEW
 * named object from a RENAMED one, so it stops on an interactive "is X created
 * or renamed from Y?" select for each of them — offering, for instance, to
 * rename `notifications.email_category` into `analytics.user_surface`. Those
 * prompts need a TTY, which a non-interactive shell cannot supply, and
 * blind-answering a rename prompt against a live database is not something to
 * do on a guess.
 *
 * The DDL below is exactly what drizzle-kit would emit for these objects
 * (verified against the live `analytics.events` conventions: identity PK,
 * timestamptz + now(), Drizzle's `<table>_<col>_<reftable>_<refcol>_fk` FK
 * naming). Once applied, `db:push` sees no diff and asks nothing — which is the
 * check that this script got it right.
 *
 * Run: `bun run scripts/db/apply-analytics-user-lane.ts`
 * Then: `bun run db:push` — expected output is "No changes detected".
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.poolQueryViaFetch = true;

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: url });
drizzle(pool);

/**
 * Each statement is independently idempotent — CREATE TYPE has no
 * IF NOT EXISTS, so it is guarded by a DO block instead.
 */
const STATEMENTS: Array<{ label: string; sql: string }> = [
	{
		label: 'enum analytics.user_surface',
		sql: `DO $$ BEGIN
			CREATE TYPE analytics.user_surface AS ENUM ('account');
		EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
	},
	{
		label: 'column analytics.events.route',
		sql: `ALTER TABLE analytics.events ADD COLUMN IF NOT EXISTS route text`,
	},
	{
		label: 'index events_route_timestamp_idx',
		sql: `CREATE INDEX IF NOT EXISTS events_route_timestamp_idx ON analytics.events (route, "timestamp")`,
	},
	{
		label: 'index events_type_timestamp_idx',
		sql: `CREATE INDEX IF NOT EXISTS events_type_timestamp_idx ON analytics.events (event_type, "timestamp")`,
	},
	{
		label: 'table analytics.user_events',
		sql: `CREATE TABLE IF NOT EXISTS analytics.user_events (
			id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
			event_id text,
			user_id text NOT NULL,
			surface analytics.user_surface NOT NULL,
			event_type analytics.event_type NOT NULL,
			route text NOT NULL,
			path text NOT NULL,
			metadata jsonb,
			"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
			CONSTRAINT user_events_pkey PRIMARY KEY (id),
			CONSTRAINT user_events_user_id_user_id_fk
				FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE
		)`,
	},
	{
		label: 'index user_events_event_id_idx (unique)',
		sql: `CREATE UNIQUE INDEX IF NOT EXISTS user_events_event_id_idx ON analytics.user_events (event_id)`,
	},
	{
		label: 'index user_events_user_ts_idx',
		sql: `CREATE INDEX IF NOT EXISTS user_events_user_ts_idx ON analytics.user_events (user_id, "timestamp")`,
	},
	{
		label: 'index user_events_route_ts_idx',
		sql: `CREATE INDEX IF NOT EXISTS user_events_route_ts_idx ON analytics.user_events (route, "timestamp")`,
	},
	{
		label: 'index user_events_ts_idx',
		sql: `CREATE INDEX IF NOT EXISTS user_events_ts_idx ON analytics.user_events ("timestamp")`,
	},
];

const client = await pool.connect();
try {
	await client.query('BEGIN');
	for (const { label, sql } of STATEMENTS) {
		await client.query(sql);
		console.log(`  ✓ ${label}`);
	}
	await client.query('COMMIT');
} catch (err) {
	await client.query('ROLLBACK');
	console.error('\n[fail] rolled back — database is unchanged');
	console.error(err);
	client.release();
	await pool.end();
	process.exit(1);
} finally {
	client.release();
}

// Verify the FK really cascades. This is the mechanism Art 17 erasure relies on
// for the authenticated lane — if it were ever created as NO ACTION or SET NULL,
// deleting an account would silently leave behavioural rows behind.
const fk = await pool.query(`
	SELECT confdeltype FROM pg_constraint WHERE conname = 'user_events_user_id_user_id_fk'
`);
const deleteRule = fk.rows[0]?.confdeltype;
console.log(
	`\n[verify] user_events.user_id ON DELETE = ${deleteRule === 'c' ? 'CASCADE ✓' : `UNEXPECTED (${deleteRule})`}`,
);

console.log('[ok] analytics user lane applied');
console.log('     next: bun run db:push — expected "No changes detected"');
await pool.end();
