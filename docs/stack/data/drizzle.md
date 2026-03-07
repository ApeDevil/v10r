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
- Migrations via Drizzle Kit

## Connection

Config lives in `drizzle.config.ts` — schema at `./src/lib/server/db/schema`, output at `./drizzle`, dialect `postgresql`.

**The Bun + drizzle-kit WebSocket gotcha:**

drizzle-kit auto-detects `@neondatabase/serverless` and internally switches to WebSocket mode. Bun's `ws` implementation mishandles the upgrade (HTTP 101). Fix: set `neonConfig.poolQueryViaFetch = true` before `defineConfig` to force HTTP fetch instead. See [drizzle-orm#4957](https://github.com/drizzle-team/drizzle-orm/issues/4957).

**Migrations:**

| Script | Command | Purpose |
|--------|---------|---------|
| `db:push` | `bunx drizzle-kit push` | Dev: direct schema sync, no files produced |
| `db:generate` | `bunx drizzle-kit generate` | Generate versioned `.sql` files in `./drizzle/` |
| `db:migrate` | `bun src/lib/server/db/migrate.ts` | Apply migrations via programmatic migrator |
| `db:studio` | `bunx drizzle-kit studio` | Visual database browser |

**Workflow:**

```bash
# 1. Make schema changes in src/lib/server/db/schema/
# 2. Generate migration SQL (committed to git)
podman exec -it v10r bun run db:generate
# 3. Apply to database
podman exec -it v10r bun run db:migrate
```

`db:push` is kept for quick local iteration but should not be the production path. It has known issues with custom schemas and enum ordering on fresh databases (see Known Limitations below).

**Why programmatic `migrate.ts` instead of `drizzle-kit migrate` CLI:**

- `drizzle-kit migrate` v0.31.0 hangs after reading config ([#4451](https://github.com/drizzle-team/drizzle-orm/issues/4451))
- Bun + `drizzle-kit migrate` crashes ([bun#23740](https://github.com/oven-sh/bun/issues/23740))
- The `migrate()` promise never resolves without explicit `process.exit()` ([#1222](https://github.com/drizzle-team/drizzle-orm/issues/1222))
- The programmatic API (`drizzle-orm/neon-serverless/migrator`) bypasses all three issues

**Custom schemas (`pgSchema`):**

This project uses 8 custom PostgreSQL schemas: `showcase`, `auth`, `ai`, `rag`, `jobs`, `notifications`, `analytics`, `app`. Two critical rules:

1. Every `pgSchema()` object **must be exported** — otherwise `generate` silently omits `CREATE SCHEMA IF NOT EXISTS`
2. Every `pgEnum()` object **must be exported** from the scanned schema file — otherwise `generate` omits `CREATE TYPE`
3. `drizzle.config.ts` must list all schemas in `schemaFilter` — this only affects `push` and `pull`, not `generate` ([#3183](https://github.com/drizzle-team/drizzle-orm/issues/3183))

**Template users:** Clone the repo, set `DATABASE_URL`, run `db:migrate`. The committed SQL files in `./drizzle/` contain all `CREATE SCHEMA`, `CREATE TYPE`, and `CREATE TABLE` statements in the correct order.

## Known limitations

**Maturity:**
- Currently v1.0.0-beta.2 (94% roadmap complete)
- Team warns: "something will definitely break"
- Can downgrade to 0.44.7 if issues arise

**Type safety caveat:**
- "Drizzle gives the impression of type-safety. However, only query results have type information. You can write invalid queries." (Prisma comparison)
- Requires more manual attention than Prisma's full type safety

**Type-checking performance:**
- As schemas grow, TypeScript compilation slows
- Drizzle requires 5,000+ type instantiations vs Prisma's few hundred
- Prisma's type-check speed more predictable at scale

**Migration tooling:**
- `drizzle-kit push` skips `CREATE TYPE` on fresh databases — enums fail with `type "x" does not exist` ([#5121](https://github.com/drizzle-team/drizzle-orm/issues/5121), fixed in beta.2, not backported to 0.31.x)
- `drizzle-kit push` does not reliably emit `CREATE SCHEMA` for custom `pgSchema` namespaces
- `schemaFilter` config is ignored by `generate` (by design) — only affects `push` and `pull`
- `drizzle-kit migrate` CLI hangs on v0.31.0 — use programmatic `migrate()` instead
- No native rollback/down migrations ([#1339](https://github.com/drizzle-team/drizzle-orm/discussions/1339), 223 upvotes, unresolved)
- Historical bugs in drizzle-kit (foreign keys, constraint handling)
- Major rewrite expanded test coverage (600 → 9,000+ tests)

**Learning curve:**
- Steeper for developers without SQL expertise
- Best for teams with strong SQL knowledge
- Prisma considered more approachable for mixed-experience teams

**Feature gaps:**
- Relational Queries API doesn't support mutations
- Smaller ecosystem than Prisma

## Related

- [postgres.md](./postgres.md) - Database
- [../auth/better-auth.md](../auth/better-auth.md) - Auth integration
