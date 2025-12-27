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

**Provider comparison:**
| Aspect | Neon | Supabase | PlanetScale |
|--------|------|----------|-------------|
| Free tier | 10 projects, 0.5 GB each | 500 MB, 2 projects | 5 GB, 1 DB |
| Branching | Copy-on-write | No | Yes |
| Serverless | Native scale-to-zero | Pooler needed | Native |
| Cold start | 500ms-few seconds | None | None |

**Neon advantages:**
- Scale-to-zero: idle databases cost nothing
- Instant provisioning (seconds, not minutes)
- Database branching for testing/staging
- Pay only for active compute time
- Free tier: 100 CU-hours/month, no credit card, never expires

## Known limitations

**Cold starts:**
- Activating from idle: 500ms to few seconds
- PgBouncer pooler mitigates (sub-100ms for subsequent queries)
- Applications may timeout during reactivation

**Connection limits:**
- Max connections: 112 (0.25 CU) to 4,000 (9+ CU)
- Transaction-mode pooling disables: prepared statements (SQL-level), LISTEN/NOTIFY, SET statements, session advisory locks

**Free tier constraints:**
- Compute suspends when 100 CU-hours/month exhausted
- 0.5 GB storage per project
- 6 hours restore history
- 1 day metrics retention
- Community support only (no SLA)

**Enterprise features (Scale plan only):**
- SOC 2, ISO, HIPAA, GDPR compliance
- IP Allow and Private Networking
- Uptime SLA guarantees

## Related

- [drizzle.md](./drizzle.md) - ORM
- [neo4j.md](./neo4j.md) - Graph data
- [r2.md](./r2.md) - File storage
- [../auth/better-auth.md](../auth/better-auth.md) - Session storage
