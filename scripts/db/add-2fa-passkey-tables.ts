#!/usr/bin/env bun
/**
 * One-off / idempotent: apply the additive DDL for the passkey + twoFactor
 * Better Auth plugin tables and the user.two_factor_enabled column.
 *
 * WHY: `db:push` raw-TTY re-prompts (the known drizzle-kit nullsNotDistinct
 * truncate prompt on unrelated tables) cannot be answered when piped, so
 * additive auth-schema DDL is applied directly — same precedent as the
 * admin-AI additive DDL and db:fix-auth-enums.
 *
 * Every statement is IF NOT EXISTS / guarded, so re-running is a no-op and a
 * fresh DB created via `db:push` (where these objects already exist) is safe.
 * Run: `bun run scripts/db/add-2fa-passkey-tables.ts`
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.poolQueryViaFetch = true;

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

const STATEMENTS: Array<[label: string, ddl: string]> = [
	[
		'auth.passkey table',
		`CREATE TABLE IF NOT EXISTS auth.passkey (
			id text PRIMARY KEY,
			name text,
			public_key text NOT NULL,
			user_id text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
			credential_id text NOT NULL,
			counter integer NOT NULL,
			device_type text NOT NULL,
			backed_up boolean NOT NULL,
			transports text,
			aaguid text,
			created_at timestamp DEFAULT now(),
			last_used_at timestamp
		)`,
	],
	['auth.passkey user index', 'CREATE INDEX IF NOT EXISTS auth_passkey_user_idx ON auth.passkey (user_id)'],
	[
		'auth.passkey credential unique',
		'CREATE UNIQUE INDEX IF NOT EXISTS auth_passkey_credential_id_uniq ON auth.passkey (credential_id)',
	],
	[
		'auth.two_factor table',
		`CREATE TABLE IF NOT EXISTS auth.two_factor (
			id text PRIMARY KEY,
			user_id text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
			secret text NOT NULL,
			backup_codes text NOT NULL,
			verified boolean NOT NULL DEFAULT false
		)`,
	],
	['auth.two_factor user index', 'CREATE INDEX IF NOT EXISTS auth_two_factor_user_idx ON auth.two_factor (user_id)'],
	[
		'user.two_factor_enabled column',
		'ALTER TABLE auth."user" ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false',
	],
];

for (const [label, ddl] of STATEMENTS) {
	await db.execute(sql.raw(ddl));
	console.log(`[ok] ${label}`);
}

console.log('\n[ok] 2FA + passkey additive DDL complete');
await pool.end();
