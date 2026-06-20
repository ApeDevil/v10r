# PostgreSQL

## What is it?

Open-source object-relational database management system. ACID-compliant with extensibility features. Supports JSON, full-text search, and rich extension ecosystem. Current versions: 14-18 (18 in preview).

**Neon:** Serverless PostgreSQL platform that separates compute and storage. Compute runs on Kubernetes, storage uses custom Pageserver backed by S3. Enables independent scaling and scale-to-zero.

## What is it for?

- Web applications requiring relational data with ACID guarantees
- Development/staging with database branching (instant schema + data duplication)
- Serverless applications with variable workloads
- Applications needing JSONB, full-text search, extensions

## Why was it chosen?

| Aspect | PostgreSQL | MySQL | SQLite |
|--------|------------|-------|--------|
| JSON | Native JSONB | JSON type | JSON functions |
| Full-text search | Built-in | Plugin | Extension |
| Concurrent writes | MVCC | Locks | Single-writer |
| Extensions | Rich ecosystem | Limited | Limited |

**Neon advantages:**
- Scale-to-zero: idle databases cost nothing
- Instant provisioning (seconds, not minutes)
- Database branching for testing/staging
- Pay only for active compute time

See [vendors.md](../vendors.md#neon) for pricing, free tier limits, and provider alternatives.

## Connection

Neon connections have two independent axes: **endpoint type** and **protocol**.

**Endpoint type:**

| Endpoint | Hostname | Notes |
|----------|----------|-------|
| Direct | `ep-xxx.region.aws.neon.tech` | Raw Postgres, required for migrations |
| Pooled | `ep-xxx-pooler.region.aws.neon.tech` | PgBouncer in transaction mode |

Pooled (PgBouncer) disables: `SET`, `PREPARE`, `LISTEN`/`NOTIFY`, session advisory locks. Use direct for all schema operations.

**Protocol:**

| Protocol | API | Use case |
|----------|-----|----------|
| HTTP fetch | `neon()` from `@neondatabase/serverless` | Serverless — stateless, no persistent connection |
| WebSocket | `Pool`/`Client` from `@neondatabase/serverless` | Session persistence, interactive transactions |
| TCP | `pg`, `postgres.js` | Traditional long-lived servers |

**What this project uses:**

- **App runtime:** `neon()` HTTP driver + `drizzle-orm/neon-http` — one fetch per query, no connection pool needed, ideal for Vercel serverless
- **drizzle-kit CLI:** reads `NEON_DATABASE_URL_PROD`, requires a direct (non-pooled) endpoint for migrations

A single direct `NEON_DATABASE_URL_PROD` covers both. The HTTP driver is already stateless — pooling adds nothing. drizzle-kit requires direct to run schema operations.

`NEON_DATABASE_URL_PROD` is this project's own variable name (not the ecosystem-standard `DATABASE_URL`) holding the Neon connection string. An optional `NEON_DATABASE_URL_DEV` labels a spare for the dev branch; it is not read by the app.

## Known limitations

**Cold starts:**
- Activating from idle: 500ms to few seconds
- PgBouncer pooler mitigates (sub-100ms for subsequent queries)
- Applications may timeout during reactivation

**Connection limits:**
- Max connections: 112 (0.25 CU) to 4,000 (9+ CU)
- Transaction-mode pooling disables: prepared statements (SQL-level), LISTEN/NOTIFY, SET statements, session advisory locks

**Free tier constraints:**
- Compute suspends when monthly CU-hours exhausted
- Limited storage per project
- Short restore history and metrics retention
- Community support only (no SLA)

See [vendors.md](../vendors.md#neon) for exact limits and paid tier features.

## Branching

Neon branches are copy-on-write clones of a parent branch — schema and data, provisioned in seconds. This project runs a `dev` branch off `production` for safe iteration.

Branches are reached through **two independent planes**:

| Plane | Endpoint | Auth | Used for |
|-------|----------|------|----------|
| Data | `postgresql://…@ep-….neon.tech/db` | role password | SQL — the app and `db:push` |
| Control | `https://console.neon.tech/api/v2` (Management API) | Bearer `NEON_API_KEY` | create / **reset-from-parent** / list branches |

**Resetting a branch to its parent has no SQL equivalent** — it exists only on the control plane. The DSN host is the endpoint id (`ep-…`), not the branch id (`br-…`) the API needs; neither the branch nor project id can be derived from the DSN.

The app ships an admin tool to reset `dev` from `production` on demand or on a schedule, with a live monitor at `/admin/db`. See [blueprint/data/neon-branch-refresh.md](../../blueprint/data/neon-branch-refresh.md).

## Related

- [drizzle.md](./drizzle.md) - ORM
- [../../blueprint/data/neon-branch-refresh.md](../../blueprint/data/neon-branch-refresh.md) - Reset dev branch from prod
- [neo4j.md](./neo4j.md) - Graph data
- [r2.md](./r2.md) - File storage
- [../auth/better-auth.md](../auth/better-auth.md) - Session storage
