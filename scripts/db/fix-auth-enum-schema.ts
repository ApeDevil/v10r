#!/usr/bin/env bun
/**
 * One-off / idempotent: move the two top-level auth enums out of `public` and
 * into the `auth` schema, so they match their schema-scoped Drizzle declarations
 * (`authSchema.enum(...)` in auth/grant.ts + auth/grant-request.ts).
 *
 * WHY: `drizzle.config.ts` `schemaFilter` does not include `public`, so
 * drizzle-kit's introspection never sees `public.grant_kind` /
 * `public.grant_request_status`, treats them as missing, and re-emits
 * `CREATE TYPE` on every `db:push` — aborting with "type grant_kind already
 * exists". Relocating the live types into `auth` removes that false-positive.
 *
 * `ALTER TYPE ... SET SCHEMA auth` is metadata-only: it moves the type WITH all
 * dependent columns and data intact (no column rewrite, no drop/recreate). Each
 * move is guarded so the script is idempotent (no-op once moved) and safe on a
 * fresh DB (where `db:push` simply creates `auth.<type>` directly).
 * Run: `bun run db:fix-auth-enums`
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

// Enums to relocate from public → auth. Trusted constants (never user input),
// so the identifier is safe to inline into the DDL via sql.raw.
const ENUMS = ['grant_kind', 'grant_request_status'];

async function schemaOf(name: string): Promise<string | null> {
	const res = await db.execute(sql`
		SELECT n.nspname AS schema
		FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typname = ${name}
	`);
	return (res.rows[0] as { schema?: string } | undefined)?.schema ?? null;
}

async function run() {
	for (const name of ENUMS) {
		// ALTER TYPE can't bind identifiers and a DO block can't take params, so the
		// guard lives here in JS: move only when it still lives in public AND auth
		// doesn't already have it. Idempotent + safe on a fresh DB (skips both).
		const inPublic = await db.execute(sql`
			SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE t.typname = ${name} AND n.nspname = 'public'
		`);
		const inAuth = await db.execute(sql`
			SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE t.typname = ${name} AND n.nspname = 'auth'
		`);

		if (inPublic.rows.length > 0 && inAuth.rows.length === 0) {
			await db.execute(sql.raw(`ALTER TYPE public.${name} SET SCHEMA auth`));
			console.log(`[ok] ${name} moved public → auth`);
		} else {
			console.log(`[skip] ${name} (already at ${(await schemaOf(name)) ?? 'absent'})`);
		}

		console.log(`[verify] ${name} → ${(await schemaOf(name)) ?? '(absent)'}`);
	}
}

await run();
console.log('\n[ok] auth enum schema reconciliation complete');
await pool.end();
