# 💾 PostgreSQL Showcase: Implementation Record

> Status: **Implemented**
> Branch: `013-i18n` (committed alongside i18n work)
> Plan: `docs/implementation/phase1-database.md`

This records what was built, what diverged from the plan, and what tripped us up.

---

## What Was Built

A PostgreSQL showcase covering the full breadth of Postgres type system and mutability patterns, integrated into Velociraptor's `/showcases/db/` route tree.

### Route Structure

```
/showcases/db/                         → Hub (Relational, Graph, Storage link cards)
  /showcases/db/relational/              → PostgreSQL hub (Connection, Types, Mutability)
    /showcases/db/relational/connection/ → Neon health check + latency tiers
    /showcases/db/relational/types/      → 10-section type showcase with SectionNav
    /showcases/db/relational/mutability/ → 5 mutability pattern showcase
```

Nav entry: `{ href: '/showcases/db', label: 'DB' }` — deep routes via hub cards, not top nav.

---

## Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `@neondatabase/serverless` | `^1.0.0` | GA since March 2025 — breaking change from 0.x |
| `drizzle-orm` | `^0.45.0` | Must be >=0.40.1 for Neon 1.0 compat |
| `drizzle-kit` | `^0.31.0` (dev) | CLI for push/generate/migrate/studio |

---

## 🐘 Schema

Seven tables in the `showcase` PostgreSQL schema. Each table is designed to demonstrate specific type categories and mutability patterns.

### Tables

| Table | Types Demonstrated | Mutability Pattern |
|-------|-------------------|-------------------|
| `type_specimen` | serial, uuid, text, varchar, char, smallint, integer, bigint, numeric, real, doublePrecision, boolean, timestamptz | Mutable CRUD (`updated_at`) |
| `type_specimen_history` | References `type_specimen` | Versioned records |
| `temporal_record` | date, time, timestamp, timestamptz, interval | Bi-temporal (`valid_from/valid_to` + `recorded_at`) |
| `document_vault` | json, jsonb (with `$type<T>`), uuid PK | Soft delete (`deleted_at`) |
| `collection_shelf` | integer[], text[], jsonb[] | Mutable |
| `network_registry` | inet, cidr, macaddr, point | Immutable (append-only) |
| `range_booking` | int4range, tstzrange, daterange (customType) | Mutable |
| `audit_log` | pgEnum (`audit_action`, `audit_severity`), bigserial | Immutable event log |

### Index Strategy

| Type | Used On | Why |
|------|---------|-----|
| B-tree (default) | Label lookups, timestamps, actor IDs | General purpose |
| GIN | `document_vault.metadata` (JSONB), `collection_shelf.tags` + scores (arrays) | Containment queries |
| GiST | `range_booking.bookingPeriod`, `reservationDates` | Range overlap queries |
| Partial | `document_vault` active titles (`WHERE deleted_at IS NULL`) | Soft-delete filtering |

---

## Database Layer

```
src/lib/server/db/
├── index.ts                           # Drizzle + Neon HTTP client (uses $env/static/private)
└── schema/
    ├── index.ts                       # Barrel export
    └── showcase/
        ├── _custom-types.ts           # Range customTypes only
        ├── type-specimen.ts
        ├── temporal-record.ts
        ├── document-vault.ts
        ├── collection-shelf.ts
        ├── network-registry.ts
        ├── range-booking.ts
        ├── audit-log.ts
        └── index.ts                   # Showcase barrel
```

---

## Routes

```
src/routes/showcases/db/
├── +page.svelte                       # DB hub (LinkCards: Relational, Graph, Storage)
└── postgres/
    ├── +page.svelte                   # PostgreSQL hub
    ├── connection/
    │   ├── +page.server.ts            # Measures latency, queries version/db size/activity
    │   └── +page.svelte
    ├── types/
    │   ├── +page.server.ts            # 7 parallel queries, one per table
    │   └── +page.svelte               # SectionNav with 10 sections
    └── mutability/
        ├── +page.server.ts
        └── +page.svelte               # SectionNav with 5 sections
```

### Connection Page

- Measures query latency with `performance.now()`
- Queries: `version()`, `current_database()`, `pg_database_size()`, `pg_stat_activity`
- Latency tiers: Warm (<100ms), Pool Wake (100–999ms), Cold Start (>1s)
- Error state renders inline — shows the raw error message, not a redirect to `+error.svelte`

### Types Page

SectionNav with 10 sections: Numeric, Text, Temporal, Boolean, UUID, JSON, Arrays, Ranges, Network, Enums.

7 queries run in parallel on load. Each section has a short description explaining when to use that type.

### Mutability Page

SectionNav with 5 sections: Mutable CRUD, Versioned, Soft Delete, Append-Only, Temporal.

Each section shows live data alongside the schema pattern. Soft delete splits active vs deleted rows visually (color-coded, strikethrough text).

---

## Config and Scripts

**`drizzle.config.ts`** (root):
- Uses `schemaFilter: ['showcase']` — required for `pgSchema` to work with drizzle-kit (see gotchas below)

**Scripts added to `package.json`:**

```json
"db:push":     "bunx drizzle-kit push",
"db:generate": "bunx drizzle-kit generate",
"db:migrate":  "bunx drizzle-kit migrate",
"db:studio":   "bunx drizzle-kit studio"
```

**Seeding** is handled in-app via the Reseed button on the types and mutability pages (`src/lib/server/db/showcase/seed.ts`).

---

## Setup

```bash
# 1. Set DATABASE_URL in .env (direct URL from Neon console, with ?sslmode=require)

# 2. Install deps
podman-compose restart app

# 3. Push schema (inside container)
bunx drizzle-kit push

# 4. Navigate to /showcases/db and use the Reseed button
```

---

## Divergences from Phase 1 Plan

The phase1 plan covered the main app database (auth tables, items, settings). This showcase is a separate concern — a dedicated `showcase` PostgreSQL schema purely for demonstrating types.

Key differences:

| Phase 1 Plan | What Was Built |
|-------------|----------------|
| `nanoid`-based prefixed IDs | Not needed for showcase tables |
| Better Auth tables | Not part of this showcase |
| `$env/dynamic/private` for DB client | Used `$env/static/private` (showcase-only, no branching needed) |
| `bunx drizzle-kit` | `bunx drizzle-kit` (same) |

---

## ⚠️ Gotchas

### `schemaFilter` is required for `pgSchema`

Without `schemaFilter: ['showcase']` in `drizzle.config.ts`, `drizzle-kit push` silently succeeds but creates nothing.

Active bug (#4796): misconfigured `schemaFilter` can also generate `DROP SCHEMA` statements. Set it explicitly.

### `@neondatabase/serverless` 1.0 is tagged-template only

The 1.0.0 release (March 2025) changed `neon()` to tagged-template syntax only. This is a breaking change from 0.x.

```typescript
// 1.0+ — correct
const result = await neon`SELECT 1`;

// 0.x style — no longer works
const result = await neon('SELECT 1');
```

### `drizzle-orm` must be >=0.40.1

Older versions break with `@neondatabase/serverless` 1.0. Pin appropriately.

### HTTP driver does not support interactive transactions

`neon()` in HTTP mode supports batched transactions only — no row locking (`FOR UPDATE`), no `SET LOCAL`. Fine for this showcase (read-heavy). Document before using for write-heavy features.

### Network types are native in Drizzle

`inet`, `cidr`, `macaddr`, `macaddr8`, `point`, `line` are all built into `drizzle-orm/pg-core`. Only range types (`int4range`, `tstzrange`, `daterange`) need `customType`.

---

## Files Created (21 total)

**Database layer (11):**
- `src/lib/server/db/index.ts`
- `src/lib/server/db/schema/index.ts`
- `src/lib/server/db/schema/showcase/index.ts`
- `src/lib/server/db/schema/showcase/_custom-types.ts`
- `src/lib/server/db/schema/showcase/type-specimen.ts`
- `src/lib/server/db/schema/showcase/temporal-record.ts`
- `src/lib/server/db/schema/showcase/document-vault.ts`
- `src/lib/server/db/schema/showcase/collection-shelf.ts`
- `src/lib/server/db/schema/showcase/network-registry.ts`
- `src/lib/server/db/schema/showcase/range-booking.ts`
- `src/lib/server/db/schema/showcase/audit-log.ts`

**Routes (8):**
- `src/routes/showcases/db/+page.svelte`
- `src/routes/showcases/db/relational/+page.svelte`
- `src/routes/showcases/db/relational/connection/+page.server.ts`
- `src/routes/showcases/db/relational/connection/+page.svelte`
- `src/routes/showcases/db/relational/types/+page.server.ts`
- `src/routes/showcases/db/relational/types/+page.svelte`
- `src/routes/showcases/db/relational/mutability/+page.server.ts`
- `src/routes/showcases/db/relational/mutability/+page.svelte`

**Config (1):**
- `drizzle.config.ts`

**Modified:**
- `package.json` — added 3 deps + 4 scripts
- `src/routes/showcases/+page.svelte` — added DB LinkCard

---

## References

- Plan: `docs/implementation/phase1-database.md`
- Stack docs: `docs/stack/data/postgres.md`, `docs/stack/data/drizzle.md`
- Showcase live: `/showcases/db`
