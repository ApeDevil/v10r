# Drizzle

ORM for the Postgres layer. See the `drizzle` skill for query/schema syntax.

## Why was it chosen?

- Always emits exactly 1 SQL query per call — matters on Neon's serverless driver routed over HTTP fetch (`poolQueryViaFetch`).
- Zero-dependency, tree-shakeable — fits Vercel serverless cold starts.
- Native Neon and Better Auth adapters.

## Connection

Config lives in `drizzle.config.ts` — points to schema directory, sets dialect and output.

**Bun + drizzle-kit WebSocket gotcha:**

drizzle-kit auto-detects `@neondatabase/serverless` and internally switches to WebSocket mode. Bun's `ws` implementation mishandles the upgrade (HTTP 101). Fix: set `neonConfig.poolQueryViaFetch = true` before `defineConfig` to force HTTP fetch instead. See [drizzle-orm#4957](https://github.com/drizzle-team/drizzle-orm/issues/4957).

## Schema management

Two tools for two stages — one TypeScript schema as the single source of truth.

- **`db:push`** (`bunx drizzle-kit push`) — diffs schema against live DB and applies directly. Best for development. Use `--strict` for approval before SQL executes.
- **`generate` + `migrate`** — produces versioned SQL files for ordered, reviewable changes. Required for production databases with real data. See [drizzle-workflow.md](../../blueprint/data/drizzle-workflow.md) for the full dev→prod workflow.
- **`db:studio`** (`bunx drizzle-kit studio`) — visual database browser.

## Custom schemas (`pgSchema`)

When using custom PostgreSQL schemas:

1. Every `pgSchema()` object **must be exported** — otherwise silently omits `CREATE SCHEMA IF NOT EXISTS`
2. Every enum **must be exported** — otherwise `db:push` silently omits `CREATE TYPE`
3. `drizzle.config.ts` must list all schemas in `schemaFilter` (only affects `push`/`pull`, not `generate`)

## Better Auth adapter: model→table by export-const name

The `drizzleAdapter` resolves a Better Auth model to its Drizzle table by the **exported const name** — `db` is built by spreading the schema, so the export *key* is the lookup key, not the SQL table name.

- `export const passkey` / `export const twoFactor` (camelCase) are **mandatory** export names.
- SQL table names are free to be snake_case (`auth.passkey`, `auth.two_factor`).
- Field keys must match the model exactly — e.g. `credentialID` (not `credential_id`) as the property key.

Get the export name wrong and the adapter writes to the wrong table or silently fails to find one. See [../auth/better-auth.md](../auth/better-auth.md) and [../../blueprint/auth.md](../../blueprint/auth.md#passkeys--step-up-totp).

## Known limitations

- Only query *results* are typed — invalid queries still compile.
- Type-checking slows as the schema grows (5,000+ type instantiations).
- Relational Queries API has no mutations.

## Related

- [postgres.md](./postgres.md) - Database
- [../auth/better-auth.md](../auth/better-auth.md) - Auth integration
- [../../blueprint/data/drizzle-workflow.md](../../blueprint/data/drizzle-workflow.md) - Dev→prod migration workflow
