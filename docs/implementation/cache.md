# Cache Showcase: Implementation Record

> Status: **Implemented**
> Branch: `016-db-cache`

This records what was built for the Upstash Redis cache showcase.

---

## What Was Built

A cache showcase demonstrating Redis data types, TTL-based expiry, and rate limiting, integrated into Velociraptor's `/showcases/db/` route tree alongside PostgreSQL, Neo4j, and R2.

### Route Structure

```
/showcases/db/                          → Hub (Relational, Graph, Storage, Cache)
  /showcases/db/cache/                  → Cache hub
    /showcases/db/cache/connection/     → Redis health check, latency, reseed
    /showcases/db/cache/patterns/       → All data types (strings, hashes, counters, sorted sets, lists)
    /showcases/db/cache/ephemeral/      → TTL countdown, sliding expiry, rate limiting, cache vs DB comparison
```

---

## Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `@upstash/redis` | `^1.36.0` | HTTP Redis client, auto-pipelining, typed commands |
| `@upstash/ratelimit` | `^2.0.0` | Sliding window rate limiting |

---

## Cache Layer

The cache layer at `$lib/server/cache/` mirrors the structure of `db/`, `graph/`, and `store/`:

```
src/lib/server/cache/
├── index.ts           # Redis client singleton, env var validation
├── types.ts           # CacheEntry, CacheEntryDetail, CacheConnectionInfo, CacheShowcaseStats, TtlSnapshot, RateLimitResult
├── errors.ts          # CacheError class, CacheErrorKind type, classifyCacheError()
└── showcase/
    ├── guards.ts      # assertShowcaseKey(), checkKeyLimit(50)
    ├── seed.ts        # reseedCache() — 15 keys across 6 types
    ├── queries.ts     # verifyConnection, listShowcaseEntries, getEntryDetail, getShowcaseStats, getTtlSnapshot, checkRateLimit
    └── mutations.ts   # setString, deleteKey, incrementCounter, decrementCounter, setHashField, deleteHashField,
                       # addToSortedSet, removeFromSortedSet, pushToList, popFromList, setTtl, removeTtl, slideTtl
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash database REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST API token |

Both validated at module load — missing either throws immediately.

---

## Showcase Pages

### Connection (`/showcases/db/cache/connection`)

- PING latency measurement with latency tier badges: Fast (<50ms), Normal (50–200ms), Degraded (>200ms)
- History tracking for last 5 latency readings
- Instance info: key count, endpoint (truncated)
- Form actions: `retest` (re-measure), `reseed` (wipe and reseed with confirm dialog)
- Error state with env var checklist when disconnected

### Patterns (`/showcases/db/cache/patterns`)

- SectionNav with 6 sections: Overview, Strings, Hashes, Counters, Sorted Sets, Lists
- **Overview**: stats grid + full entry table with key, type badge, TTL, and inspect button
- **Strings**: FormField + Input form for SET with key/value/TTL; JSON viewer for values
- **Hashes**: load fields, HSET/HDEL operations
- **Counters**: large number display with +/- buttons, live updates
- **Sorted Sets**: leaderboard table sorted by score, ZADD/ZREM forms
- **Lists**: LPUSH/RPUSH/LPOP/RPOP buttons with queue visualization
- 11 form actions total

### Ephemeral (`/showcases/db/cache/ephemeral`)

- TTL countdown cards showing remaining seconds (formatted)
- Sliding expiry with before/after comparison
- Rate limiting with Progress bar showing remaining/limit
- Cache vs DB comparison Table (educational, no interactive elements)
- 4 form actions total

---

## Seed Data

15 keys across 6 types. `reseedCache()` is idempotent: clears all `showcase:*` keys then reseeds.

| Type | Keys |
|------|------|
| String (plain) | `showcase:config:site-name`, `showcase:config:version`, `showcase:json:stack-summary` |
| String (TTL) | `showcase:ttl:verification-code` (300s), `showcase:ttl:flash-message` (30s), `showcase:ttl:session-token` (3600s) |
| String (counter) | `showcase:counter:page-views` (1500000), `showcase:counter:api-calls-today` (4200) |
| Hash | `showcase:hash:feature-flags` (5 fields), `showcase:hash:user-prefs` (4 fields) |
| Sorted Set | `showcase:leaderboard:tech-popularity` (8 members) |
| List | `showcase:queue:recent-events` (5 items) |

---

## Safety Guards

| Guard | Limit | Purpose |
|-------|-------|---------|
| `assertShowcaseKey()` | `showcase:` prefix | Prevent operations outside showcase namespace |
| `checkKeyLimit()` | 50 keys max | Prevent unbounded growth |

---

## Error Handling

`classifyCacheError()` maps Upstash errors to normalized `CacheErrorKind`:

| Error Pattern | CacheErrorKind |
|---------------|---------------|
| `"Unauthorized"` / `"401"` / `UrlError` | `credentials` |
| `"WRONGTYPE"` | `command` |
| `"timeout"` / `"ETIMEDOUT"` / `TimeoutError` | `timeout` |
| `"rate"` / `"429"` | `limit` |
| `TypeError` / `"fetch failed"` | `unavailable` |
| Everything else | `unknown` |

---

## Design Decisions

**Module-level singleton** — `redis` exported from `index.ts`, imported where needed. Not placed in `hooks.server.ts` or `locals` — HTTP is stateless, no connection lifecycle to manage.

**`$env/static/private` over `Redis.fromEnv()`** — SvelteKit type safety and client-bundle protection. `fromEnv()` reads `process.env` at runtime and bypasses SvelteKit's env analysis.

**Module-level `ephemeralCache`** — `new Map()` for the rate limiter declared at module scope, not inside request handlers. Persists across warm serverless invocations. Inside a handler, it resets every request.

**`KEYS` pattern** — acceptable for showcase (≤50 keys, enforced by `checkKeyLimit()`). Production would use `SCAN` with cursor pagination.

---

## Technology Choice: Upstash Redis

### Principle Evaluation

| Principle | Verdict | Notes |
|-----------|---------|-------|
| Libraries over services | **Exception** | Same exception as Neon, Aura, R2 — all are cloud services. Cache in serverless is impractical to self-host (no persistent state between invocations). |
| Lightweight over feature-rich | **Pass** | `@upstash/redis` ~15KB, HTTP-only, zero native deps. `@upstash/ratelimit` ~5KB. |
| Standard protocols | **Pass** | Redis command set is the industry standard. Swappable to any Redis-compatible backend (Dragonfly, KeyDB, self-hosted). |
| Free tier friendly | **Pass** | 500K commands/month, 256MB storage, 10K req/sec. Showcase uses ~20 keys, negligible consumption. |
| Svelte-native first | **N/A** | Server-side only. |
| No code generation | **Pass** | Pure runtime client, no codegen. |
| Speed is a feature | **Pass** | ~4–5ms avg latency from Vercel us-east-1 (HTTP). No TCP connection overhead in serverless. |

### Why Not Alternatives

| Alternative | Reason to Reject |
|-------------|-----------------|
| In-memory Map with TTL | Per-instance only in serverless — each Vercel function invocation starts cold. Cache would show "hit: never". Defeats the purpose of a showcase. |
| PostgreSQL UNLOGGED tables | Not a standard caching pattern. Nobody reaching for a cache uses UNLOGGED tables. |
| SQLite via Bun | Does not work on Vercel serverless (no writable filesystem). |
| Vercel KV | Vendor-locked API (`@vercel/kv`). Under the hood it IS Upstash — go direct for standard protocols. Vercel deprecated KV for new projects in late 2024. |
| ioredis (TCP) | Edge/serverless cannot open persistent TCP connections. HTTP is the only path that works on all runtimes. |

### Architectural Fit

All four data engines follow the same pattern:

| Paradigm | Service | Protocol | Client |
|----------|---------|----------|--------|
| Relational | Neon | HTTP | `@neondatabase/serverless` |
| Graph | Neo4j Aura | HTTP | Custom fetch wrapper |
| Object Storage | Cloudflare R2 | S3/HTTP | `@aws-sdk/client-s3` |
| **Cache** | **Upstash** | **HTTP/REST** | **`@upstash/redis`** |

---

## SDK Reference

### Client Initialization

```typescript
import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/static/private';

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});
```

### Auto-Pipelining

Enabled by default. Concurrent awaits in the same event loop tick batch into a single HTTP POST:

```typescript
// These become ONE HTTP request automatically:
const [a, b, c] = await Promise.all([
  redis.get('key1'),
  redis.get('key2'),
  redis.incr('counter'),
]);
```

### Command Signatures

```typescript
// Strings
redis.set(key, value, { ex: seconds })    → Promise<"OK" | null>
redis.get<T>(key)                          → Promise<T | null>
redis.mget<T[]>(...keys)                   → Promise<T[]>
redis.incr(key)                            → Promise<number>
redis.incrby(key, n)                       → Promise<number>
redis.decr(key)                            → Promise<number>
redis.decrby(key, n)                       → Promise<number>

// Hashes
redis.hset(key, { field: value })          → Promise<number>  // count of NEW fields
redis.hget<T>(key, field)                  → Promise<T | null>
redis.hgetall<T>(key)                      → Promise<T | null>  // null if key missing (NOT {})
redis.hdel(key, ...fields)                 → Promise<number>

// Sorted Sets
redis.zadd(key, { score, member })         → Promise<number>
redis.zrange(key, min, max, opts?)         → Promise<string[]>
redis.zrem(key, ...members)                → Promise<number>
redis.zcard(key)                           → Promise<number>
redis.zscore(key, member)                  → Promise<number | null>

// Lists
redis.lpush(key, ...elements)             → Promise<number>  // new length
redis.rpush(key, ...elements)             → Promise<number>
redis.lpop<T>(key)                         → Promise<T | null>
redis.rpop<T>(key)                         → Promise<T | null>
redis.lrange<T>(key, start, stop)          → Promise<T[]>

// Key Management
redis.del(...keys)                         → Promise<number>
redis.exists(...keys)                      → Promise<number>
redis.type(key)                            → Promise<"string" | "list" | "set" | "zset" | "hash" | "none">
redis.ttl(key)                             → Promise<number>  // -2=gone, -1=no TTL, else seconds
redis.expire(key, seconds)                 → Promise<0 | 1>
redis.persist(key)                         → Promise<0 | 1>
redis.keys(pattern)                        → Promise<string[]>  // OK for small datasets only

// Server
redis.ping()                               → Promise<"PONG">
```

### Error Classes

Three error classes from `@upstash/redis`:
- `UpstashError` — Redis operation failures (auth, limits, command errors)
- `UrlError` — Invalid URL in constructor
- `TypeError` — Network fetch failure (DNS, TLS — from Fetch API, not Redis)

Default retry: 5 retries with exponential backoff (~50ms, ~135ms, ~365ms, ~990ms, ~2690ms).

### Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  ephemeralCache: new Map(),  // MUST be module-level, NOT inside handlers
});

const { success, remaining, limit, reset } = await ratelimit.limit(identifier);
```
