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

## Related

- [drizzle.md](./drizzle.md) - ORM
- [neo4j.md](./neo4j.md) - Graph data
- [r2.md](./r2.md) - File storage
- [../auth/better-auth.md](../auth/better-auth.md) - Session storage
