# Drizzle

## What is it?

Headless TypeScript ORM—a library and collection of complementary opt-in tools. SQL-first query builder with zero runtime dependencies. "If you know SQL, you know Drizzle."

## What is it for?

- Serverless/edge environments where cold start and bundle size matter
- SQL-first development with direct query control
- Type-safe database access with TypeScript inference
- Projects requiring minimal dependencies

## Why was it chosen?

| Aspect | Drizzle | Prisma | Kysely |
|--------|---------|--------|--------|
| Bundle size | ~7.4 KB | 15+ MB | ~2 MB |
| Code generation | None | Required | None |
| Serverless/Edge | Perfect | Too heavy | Good |
| Philosophy | SQL-in-TypeScript | ORM abstraction | Query builder |

**Key advantages:**
- Zero dependencies, tree-shakeable
- Mirrors SQL syntax closely (minimal abstraction)
- Always outputs exactly 1 SQL query (serverless connection efficiency)
- Type inference from TypeScript schemas (no codegen step)
- Native Neon and Better Auth support

**SQL-like queries:**
- Full control over generated SQL
- Relational queries with `with` clause

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
2. Every `pgEnum()` object **must be exported** — otherwise silently omits `CREATE TYPE`
3. `drizzle.config.ts` must list all schemas in `schemaFilter` (only affects `push`/`pull`, not `generate`)

## Known limitations

**Type safety caveat:**
- Only query results have type information — you can write invalid queries
- Requires more manual attention than Prisma's full type safety

**Type-checking performance:**
- As schemas grow, TypeScript compilation slows
- Drizzle requires 5,000+ type instantiations vs Prisma's few hundred

**Feature gaps:**
- Relational Queries API doesn't support mutations
- Smaller ecosystem than Prisma
- Steeper learning curve for developers without SQL expertise

## Related

- [postgres.md](./postgres.md) - Database
- [../auth/better-auth.md](../auth/better-auth.md) - Auth integration
- [../../blueprint/data/drizzle-workflow.md](../../blueprint/data/drizzle-workflow.md) - Dev→prod migration workflow
