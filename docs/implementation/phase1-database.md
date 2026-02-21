# Phase 1: Database Foundation

> Status: **Planned**
> Branch: TBD
> Prerequisites: Neon project created, `DATABASE_URL` and `DATABASE_URL_DIRECT` set in `.env`


## Overview

Establish the database layer with Drizzle ORM connected to Neon PostgreSQL (serverless). This is the critical path — auth, forms, CRUD, settings, and GDPR all depend on having a working database.


## Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `drizzle-orm` | prod | ORM core — pin exact version (beta instability) |
| `@neondatabase/serverless` | prod | Neon HTTP driver (stateless, no pool needed) |
| `nanoid` | prod | Prefixed ID generation |
| `better-auth` | prod | Auth framework — needed now because schema references its tables |
| `drizzle-kit` | dev | Migration generator, push, studio CLI |


## File Structure

```
drizzle.config.ts                          # Drizzle Kit config (project root)

src/lib/server/db/
├── index.ts                               # DB client (neon-http + drizzle), public API
├── id.ts                                  # Prefixed nanoid (usr_, itm_, tag_, fil_, ses_)
├── types.ts                               # InferSelectModel/InferInsertModel + composites
├── errors.ts                              # PG error code -> SvelteKit HTTP error mapping
├── relations.ts                           # Drizzle relation definitions for db.query API
└── schema/
    ├── index.ts                           # Barrel re-export (all 5 schema files)
    ├── _better-auth.ts                    # Generated Better Auth tables (committed, _ = machine-managed)
    ├── auth.ts                            # userProfile (1:1 user extension)
    ├── settings.ts                        # userSettings + theme enum
    ├── items.ts                           # items, tags, itemTags (showcase CRUD)
    └── files.ts                           # File upload metadata (bytes live in R2)
```

**New directories:** `src/lib/server/`, `src/lib/server/db/`, `src/lib/server/db/schema/`

**Total new files:** 12 (1 config + 11 source)


## Schema Design

### Entity Relationships

```
user (Better Auth)
├── 1:1  userProfile      (bio, website, timezone)
├── 1:1  userSettings      (theme, language, notifications)
├── 1:N  session           (Better Auth)
├── 1:N  account           (Better Auth - OAuth providers)
├── 1:N  items             (showcase CRUD content)
└── 1:N  files             (upload metadata)

items
├── 1:N  files             (optional attachment)
└── N:M  tags              (via itemTags junction)
```

### Tables

#### Better Auth Tables (`_better-auth.ts`)

| Table | PK | Key Columns | Notes |
|-------|-----|-------------|-------|
| `user` | text | email (unique, not null), name, emailVerified, image | Auto-generated |
| `session` | text | userId FK, token (unique), expiresAt, ipAddress, userAgent | Indexes: userId, expiresAt |
| `account` | text | userId FK, providerId, providerUserId, accessToken, refreshToken | OAuth providers |
| `verification` | text | identifier, value, expiresAt | Magic link / OTP tokens |

#### Custom Tables

| Table | PK | Key Columns | FK → | ON DELETE |
|-------|-----|-------------|------|----------|
| `userProfile` | userId (FK+PK) | bio, website, timezone (default 'UTC') | user.id | CASCADE |
| `userSettings` | userId (FK+PK) | theme (enum), language (default 'en'), notificationsEnabled | user.id | CASCADE |
| `items` | text | userId, title (not null), description, content, status (enum), imageUrl | user.id | CASCADE |
| `tags` | text | name (unique, not null), color (default '#6b7280') | — | — |
| `itemTags` | composite | itemId, tagId | items.id, tags.id | CASCADE both |
| `files` | text | userId, itemId (nullable), filename, storageKey, size, mimeType | user.id, items.id | CASCADE / SET NULL |

#### Enums

- `theme`: `'light' | 'dark' | 'system'`
- `item_status`: `'draft' | 'published' | 'archived'`

### Index Strategy

**Custom tables** — indexes inside pgTable 3rd parameter callback:

| Table | Index | Columns | Justification |
|-------|-------|---------|--------------|
| `items` | `items_user_id_status_created_idx` | `(userId, status, createdAt)` | Composite for "my items by status" (hot path) |
| `files` | `files_user_id_idx` | `userId` | "My files" query |
| `files` | `files_item_id_idx` | `itemId` | Item attachments lookup |

**Better Auth tables** — standalone index exports (cannot modify generated pgTable):

| Table | Index | Columns | Justification |
|-------|-------|---------|--------------|
| `session` | `session_user_id_idx` | `userId` | Session lookups by user |
| `session` | `session_expires_at_idx` | `expiresAt` | Session cleanup cron |

> **Why the split?** Indexes inside pgTable 3rd param are the correct pattern for custom tables. But `_better-auth.ts` is auto-generated — we can't modify its pgTable calls. Standalone exports are the only option for Better Auth indexes. Both patterns generate valid migrations.

### ID Generation

Prefixed nanoid strings stored as `text` columns:

| Entity | Prefix | Length | Example |
|--------|--------|--------|---------|
| User | `usr_` | 12 | `usr_V1StGXR8_Z5j` |
| Session | `ses_` | 24 | `ses_V1StGXR8_Z5jKl3nOpQr...` |
| Item | `itm_` | 12 | `itm_abc123def456` |
| Tag | `tag_` | 8 | `tag_xYz12AbC` |
| File | `fil_` | 12 | `fil_abc123def456` |
| Token | (none) | 32 | raw nanoid |

Better Auth generates its own IDs for its tables. The `createId` helpers exist for manual use (seeding, pre-generating IDs).


## Key Architectural Decisions

### 1. Connection Driver: `neon-http` (stateless)

Use `neon-http` for Phase 1. Each query is an independent HTTP request — no connection pool to manage.

**Limitations:**
- `db.transaction()` works via HTTP batching, but no row locking (`FOR UPDATE`), no `SET LOCAL`, no multi-statement session guarantees
- Phase 1 use cases (simple inserts, updates) don't need these features

**Upgrade path:** When row locking or real transaction isolation is needed, switch internals of `db/index.ts` to `neon-serverless` with `Pool` + Vercel Fluid Compute (`attachDatabasePool`). No consumer code changes needed.

### 2. Environment Variables

| Context | Approach | Why |
|---------|----------|-----|
| SvelteKit server code (`db/index.ts`) | `$env/dynamic/private` | Runtime resolution; works with Neon branching + Vercel preview deployments |
| Drizzle Kit CLI (`drizzle.config.ts`) | `process.env` | Runs outside SvelteKit; `$env` not available |
| Migration connection | `DATABASE_URL_DIRECT` | Non-pooled connection required for DDL operations |

Add to `.env.example`:
```
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
DATABASE_URL_DIRECT="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
```

### 3. Module Boundary

`src/lib/server/db/index.ts` is the single public API:
```
Exports: db client, schema, types from ./types, IDs from ./id
```

Error handling is done inline in load functions and form actions — no shared error utility module.

### 4. Schema Organization

- Multi-file with barrel export (`schema/index.ts`)
- `_` prefix for auto-generated files (never edit)
- Custom tables in domain-grouped files
- Better Auth schema committed to repo (not generated at install time)

### 5. Error Handling

```
Layer 1: DB module         — does NOT catch errors (pure data access)
Layer 2: Load functions    — catch and map PG error codes inline (knows HTTP context)
Layer 3: handleError hook  — catches unexpected escapes (safety net)
```

### 6. Type Flow

```
Schema (pgTable) → InferSelectModel/InferInsertModel (types.ts)
  → Load function return (auto-inferred by SvelteKit $types)
    → Component $props().data (auto-inferred)
```

- Use Better Auth types (`import('better-auth').User`) for auth layer (`app.d.ts`, hooks)
- Use Drizzle inferred types for database layer (queries, mutations)
- Don't unify them — they're compatible but not the same TypeScript type
- Prefer `Awaited<ReturnType<typeof queryFn>>` for composite/relational queries

### 7. Query Functions (Phase 1)

Colocate with routes. Only extract to `db/queries/` when a query has 2+ consumers.

Use `db.select()` for simple queries (less overhead). Reserve `db.query` (relational API) for queries that need `.with()` joins.


## Implementation Steps

| Step | Action | Validates |
|------|--------|-----------|
| 1 | Add deps to `package.json`, restart container | Packages install in Bun |
| 2 | Add `DATABASE_URL_DIRECT` to `.env.example` | Env var template complete |
| 3 | Create `drizzle.config.ts` (uses `DATABASE_URL_DIRECT`) | Config parses |
| 4 | Create `src/lib/server/db/schema/_better-auth.ts` | Better Auth tables compile |
| 5 | Create `src/lib/server/db/schema/auth.ts` | userProfile references user |
| 6 | Create `src/lib/server/db/schema/settings.ts` | userSettings + enum compile |
| 7 | Create `src/lib/server/db/schema/items.ts` | items, tags, itemTags compile |
| 8 | Create `src/lib/server/db/schema/files.ts` | files references items + user |
| 9 | Create `src/lib/server/db/schema/index.ts` | Barrel re-exports all 5 files |
| 10 | Create `src/lib/server/db/id.ts` | ID generation works |
| 11 | Create `src/lib/server/db/relations.ts` | Relations reference valid tables |
| 12 | Create `src/lib/server/db/types.ts` | Type inference works |
| 13 | Create `src/lib/server/db/index.ts` | DB client connects to Neon |
| 14 | Run `bunx drizzle-kit push` (inside container) | Tables created on Neon |
| 15 | Verify with `bunx drizzle-kit studio` | Visual confirmation |
| 16 | Add convenience scripts to `package.json` | `db:generate`, `db:migrate`, `db:push`, `db:studio` |

### Convenience Scripts

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

Run from host: `podman exec -it v10r bun run db:push`


## Known Risks

### Neon Cold Starts
- Free tier suspends after ~5 min idle
- First request after idle: ~800ms
- Warm requests: ~350ms
- Not a code issue — platform characteristic
- Production fix: Neon Pro (always-on compute)

### Drizzle v1 Beta
- Currently beta; "something will definitely break"
- Pin exact version in `package.json` (no `^` prefix)
- Test migrations on Neon branch before applying to main
- Fallback: downgrade to 0.44.7 if needed

### Neon HTTP Driver Error Shape
- Neon's HTTP driver may wrap PG errors differently than `pg` client
- Test `mapDbError` with actual Neon errors during implementation
- The `code` property may need unwrapping

### Better Auth Schema Drift
- Upgrading Better Auth may change generated schema
- Pin Better Auth version alongside Drizzle
- Consider CI check: regenerate and diff against committed file


## Deferred to Phase 2 (Auth)

These items depend on the database but belong to the auth implementation:

- `src/lib/server/auth.ts` — Better Auth instance configuration
- `src/hooks.server.ts` — Auth handler + session population (dual-handler with `sequence()`)
- `src/app.d.ts` — `Locals` interface with `user` and `session` types
- `cookieCache` — Must enable (`maxAge: 300`) to avoid DB hit on every request
- Session cleanup cron — Expired sessions pile up forever without it
- Rate limiting — Better Auth's built-in rate limiting is **BROKEN** (GitHub #2153); must use `sveltekit-rate-limiter`
- Auth forms use Better Auth client directly, NOT Superforms
- Route protection must be per-route (`requireAuth()` in each `+page.server.ts`), not layout-only


## References

- Blueprint: `docs/blueprint/db/relational.md`
- Blueprint: `docs/blueprint/auth.md`
- Skills: `drizzle`, `db-relational`, `better-auth`
- Neon docs: connection methods, serverless driver, branching
