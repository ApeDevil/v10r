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

| Command | Purpose |
|---------|---------|
| `drizzle-kit push` | Dev: direct sync, no migration files |
| `drizzle-kit generate` | Prod: create migration files |
| `drizzle-kit migrate` | Prod: apply migration files |

Use `push` during active development. Switch to `generate` + `migrate` before going to production.

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
- Historical bugs in drizzle-kit (foreign keys, constraint handling)
- Major rewrite expanded test coverage (600 → 9,000+ tests)
- Less intuitive for developers unfamiliar with raw SQL migrations

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
