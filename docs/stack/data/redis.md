# Redis (Upstash)

## What is it?

Redis is an in-memory key-value store. It holds data in RAM, making reads and writes orders of magnitude faster than disk-based databases. Upstash is the managed provider — it exposes Redis over HTTP REST instead of a persistent TCP connection. The client is ~15KB and requires no connection pooling.

## What is it for?

- Rate limiting (sliding window counters per user/IP)
- Session data (short-lived, fast-access tokens)
- Feature flags (per-user or global toggles)
- Leaderboards (sorted sets with automatic ranking)
- Pub/sub messaging (real-time event broadcasting)
- Caching hot queries (pre-computed results for expensive reads)
- Atomic counters (view counts, download tallies)

**Rule of thumb:** Use Redis when data is ephemeral, needs sub-10ms access, or its disappearance is acceptable.

## Why was it chosen?

| Approach | Serverless-safe | Sub-10ms | Rate limiting | Free tier |
|---|---|---|---|---|
| In-memory `Map` | No (resets per request) | Yes | No | N/A |
| PostgreSQL UNLOGGED | Yes | No (~5–20ms) | Manual | Yes |
| Vercel KV | Yes | Yes | No | 30K cmd/month |
| ioredis (TCP) | No (persistent conn required) | Yes | Manual | Varies |
| **Upstash (HTTP)** | **Yes** | **Yes** | **Built-in** | **500K cmd/month** |

**Key advantages:**

- HTTP-only transport — works in serverless functions and edge runtimes with no connection state
- Auto-pipelining batches multiple commands into a single HTTP request automatically
- Sliding window rate limiting built into the SDK (`@upstash/ratelimit`)
- Full Redis command compatibility — not a subset or emulation
- Free tier: 500K commands/month, 256MB storage

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

## Related

- [postgres.md](./postgres.md) - Relational data, ACID transactions
- [neo4j.md](./neo4j.md) - Graph data, relationship traversal
- [r2.md](./r2.md) - Object storage for files and blobs
