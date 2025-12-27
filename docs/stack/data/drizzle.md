# Drizzle

ORM for PostgreSQL. Type-safe, lightweight, SQL-first.

## Why Drizzle

| Aspect | Drizzle | Prisma | Kysely |
|--------|---------|--------|--------|
| Bundle Size | ~50 KB | 15+ MB | ~2 MB |
| Code Generation | None | Required | None |
| Serverless/Edge | Perfect | Too heavy | Good |
| Philosophy | SQL-in-TypeScript | ORM abstraction | Query builder |

Drizzle wins: lightweight bundle, no codegen, SQL-first, Bun-native.

## Stack Integration

| Layer | Technology | Why |
|-------|------------|-----|
| ORM | **Drizzle** | Type-safe, lightweight, Bun-compatible |
| Migrations | **Drizzle Kit** | Schema-driven, SQL-first |
| Provider | **Neon** | Serverless PostgreSQL |
| Auth | **Better Auth** | Native Drizzle adapter |

## Key Features

- **Type inference** from schema (no codegen)
- **SQL-like syntax** in TypeScript
- **Relational queries** with `with` clause
- **Migrations** via Drizzle Kit
- **Edge-compatible** (small bundle)

## Schema Pattern

Define tables in `src/lib/server/db/schema/`. Export from `index.ts`.

Better Auth requires specific table names. See [../auth/better-auth.md](../auth/better-auth.md).

## Commands

```bash
bun run db:generate   # Generate migration from schema changes
bun run db:migrate    # Apply migrations
bun run db:push       # Push schema directly (dev only)
bun run db:studio     # Open Drizzle Studio
```

## Related

- [postgres.md](./postgres.md) - Database
- [../auth/better-auth.md](../auth/better-auth.md) - Auth integration
- [../../blueprint/db/](../../blueprint/db/) - Implementation details
