# Redis (Upstash)

In-memory key-value store, hosted on **Upstash** over HTTP REST (no persistent TCP, no connection pool). Backs rate limiting, the circuit breaker, and ephemeral counters.

## Why was it chosen?

- HTTP-only transport works in serverless and edge runtimes with no connection state — TCP clients (`ioredis`) can't.
- Sliding-window rate limiting ships in the SDK (`@upstash/ratelimit`).

See [vendors.md](../vendors.md) for pricing details and provider alternatives.

## Known limitations

**Deserialization surprises:**
- Numbers stored as strings come back typed as `number`, not `string`. Don't assume type roundtrip fidelity — validate on read.

**Key scanning:**
- `KEYS *` scans the full keyspace synchronously. At 100K+ keys it blocks and degrades performance. Use `SCAN` with a cursor instead.

**Missing hash keys:**
- `hgetall` returns `null` for a missing hash key, not an empty object `{}`. Guard against this before iterating.

**Free tier inactivity:**
- Databases inactive for 14 days are archived and require manual restoration. Not suitable for infrequently accessed production data without a keep-alive strategy.

**Consistency model:**
- Redis is not ACID. It is eventually consistent under replication. Do not use it as the source of truth for financial or transactional data.

**Latency from region mismatch:**
- Upstash routes requests to the nearest replica. If your function region and Redis region differ, expect 500ms+ latency. Co-locate regions.

## Connection latency tiers

Upstash is always-on over HTTP — no cold starts, no connection warmup. Round-trip time reflects only network distance to the Upstash region:

| Tier | Latency | Meaning |
|------|---------|---------|
| Fast | < 50ms | Upstash region matches the deployment region |
| Normal | 50–200ms | Cross-region or moderate network distance |
| Degraded | > 200ms | Region mismatch (see above) or network issues |

Live at `/showcases/db/cache/connection`.

## Related

- [postgres.md](./postgres.md) - Relational data, ACID transactions
- [neo4j.md](./neo4j.md) - Graph data, relationship traversal
- [r2.md](./r2.md) - Object storage for files and blobs
