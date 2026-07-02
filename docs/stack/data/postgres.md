# PostgreSQL

The relational store, hosted on **Neon** (serverless Postgres: compute/storage split, scale-to-zero, copy-on-write branching). See the `db-relational` skill for query patterns.

## Why was it chosen?

- Neon branching gives instant copy-on-write `dev` clones off `production` (see [Branching](#branching)).
- Scale-to-zero — idle databases cost nothing on the free tier.

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

- **App runtime:** `drizzle-orm/neon-serverless` with `Pool` from `@neondatabase/serverless`, plus `neonConfig.poolQueryViaFetch = true` so Pool queries travel over HTTP fetch instead of WebSocket. This is the same Bun WebSocket-101 workaround used in `drizzle.config.ts`.
- **drizzle-kit CLI:** reads `NEON_DATABASE_URL_PROD`, requires a direct (non-pooled) endpoint for migrations

A single direct `NEON_DATABASE_URL_PROD` covers both. drizzle-kit requires direct to run schema operations.

`NEON_DATABASE_URL_PROD` is this project's own variable name (not the ecosystem-standard `DATABASE_URL`) holding the Neon connection string. An optional `NEON_DATABASE_URL_DEV` labels a spare for the dev branch; it is not read by the app.

### Transactions under Bun (verified)

`db.transaction()` (the `neon-serverless` driver with `poolQueryViaFetch = true`) was probed under the Bun dev container: both ROLLBACK and COMMIT behave correctly. So the 22 `db.transaction()` call sites are safe under Bun, not only under Node on Vercel. This closes a question the pglite unit tests can't answer — they don't exercise the real driver.

Probe: `scripts/db/verify-tx-rollback.ts`

```bash
podman exec v10r bun run scripts/db/verify-tx-rollback.ts
```

## Known limitations

- **Cold starts:** activating from idle takes 500ms–few seconds; requests may time out during reactivation.
- **Free tier:** compute suspends when monthly CU-hours are exhausted.

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
