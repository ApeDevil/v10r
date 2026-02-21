# Cache Showcase: Implementation Plan

> Status: **Planned**
> Branch: `015-db-graph` (or new branch)
> Paradigm: Ephemeral key-value data with TTL

---

## Context

Velociraptor showcases three data paradigms: relational (Neon PostgreSQL), graph (Neo4j Aura), and object storage (Cloudflare R2). Each follows an identical structure: server-side client in `src/lib/server/`, error classification, types, showcase queries/mutations/guards/seed, and three route pages (connection, core features, advanced patterns).

This plan adds **cache** as the fourth paradigm using **Upstash Redis** via HTTP REST. Cache is the only paradigm where disappearance is a feature — data is ephemeral, TTL-governed, and designed to expire.

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
| Speed is a feature | **Pass** | ~4-5ms avg latency from Vercel us-east-1 (HTTP). No TCP connection overhead in serverless. |

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

## Dependencies

### npm Packages

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `@upstash/redis` | `^1.36.0` | ~15KB | HTTP Redis client, auto-pipelining, typed commands |
| `@upstash/ratelimit` | `^2.0.0` | ~5KB | Sliding window rate limiting |

### Environment Variables

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

Obtain from [console.upstash.com](https://console.upstash.com) → Create Redis database → REST API section.

**Region**: Choose `us-east-1` to match Vercel's default function region (minimizes latency).

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

**Key decisions:**
- Use `$env/static/private` (NOT `Redis.fromEnv()`) for SvelteKit type safety and client-bundle protection
- NO `building` guard — existing engines (db, graph, store) don't use it, container always has env vars
- Module singleton pattern (import where needed) — NOT hooks.server.ts / locals (HTTP is stateless, no connection lifecycle)

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

### Command Signatures (Key Ones)

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

### Error Handling

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

---

## Known Gotchas

| Gotcha | Impact | Mitigation |
|--------|--------|------------|
| Auto-deserialization | `"123"` stored as string returns as number `123` | Accept it (consistent with typed generics) or set `automaticDeserialization: false` |
| `hgetall` returns `null` | Unlike other clients that return `{}` for missing keys | Always null-check hgetall results |
| `KEYS` breaks silently at 100K+ keys | Returns empty instead of erroring | Fine for showcase (~20 keys). Use `SCAN` in production. |
| Region mismatch → 500ms+ latency | Upstash region must match Vercel region | Create Upstash DB in `us-east-1` |
| Free tier archives after 14 days inactivity | Data preserved, restorable from backup | Acceptable for dev/showcase |
| `ephemeralCache` Map placement | Must be module-level to persist across serverless warm invocations | Declare outside handler functions |

---

## Implementation Steps

### Step 1: Server-Side Cache Module

Create `src/lib/server/cache/` mirroring the store/graph pattern.

#### 1a. `src/lib/server/cache/errors.ts`

| Export | Pattern Mirror |
|--------|---------------|
| `CacheErrorKind` type | `StoreErrorKind`, `Neo4jErrorKind` |
| `CacheError` class | `StoreError`, `Neo4jError` |
| `classifyCacheError(err)` | `classifyS3Error(err)`, `classifyError(code)` |

Error kinds: `'credentials' | 'command' | 'timeout' | 'limit' | 'unavailable' | 'unknown'`

Classification maps:
- `WRONGTYPE` → `'command'`
- `Unauthorized` / `401` → `'credentials'`
- `timeout` / `ETIMEDOUT` → `'timeout'`
- `rate` / `429` → `'limit'`
- Everything else → `'unknown'`

#### 1b. `src/lib/server/cache/index.ts`

```
Import Redis from @upstash/redis
Import env vars from $env/static/private
Validate env vars (throw CacheError if missing)
Export redis singleton
```

Mirrors: `src/lib/server/store/index.ts` (7 lines), `src/lib/server/db/index.ts` (8 lines)

#### 1c. `src/lib/server/cache/types.ts`

| Interface | Fields | Like |
|-----------|--------|------|
| `CacheEntry` | key, type, ttl | `ObjectInfo` |
| `CacheEntryDetail` | extends CacheEntry + value | `ObjectDetail` |
| `CacheConnectionInfo` | connected, latencyMs, keyCount, measuredAt | `BucketStats` |
| `CacheShowcaseStats` | keyCount, keysByType | — |
| `TtlSnapshot` | key, remainingSeconds, isExpired, capturedAt | — |
| `RateLimitResult` | allowed, remaining, limit, resetAt, windowSeconds | — |

Plus `formatTtl(seconds): string` utility (mirrors `formatBytes(bytes)` in store/types.ts).

---

### Step 2: Showcase Logic

Create `src/lib/server/cache/showcase/` with four files.

#### 2a. `showcase/guards.ts`

- `SHOWCASE_PREFIX = 'showcase:'`
- `MAX_SHOWCASE_KEYS = 50`
- `assertShowcaseKey(key)` — throws if key doesn't start with prefix
- `checkKeyLimit(limit?)` — returns error message string if limit reached, else null
- Mirrors: `src/lib/server/store/showcase/guards.ts`

#### 2b. `showcase/seed.ts`

`reseedCache(): Promise<{ keyCount: number }>`

1. Clear: `redis.keys('showcase:*')` → `redis.del(...keys)`
2. Seed entries:

| Key | Type | Value | TTL |
|-----|------|-------|-----|
| `showcase:config:site-name` | string | `"Velociraptor"` | — |
| `showcase:config:version` | string | `"0.0.1"` | — |
| `showcase:json:stack-summary` | string (JSON) | `{runtime:"Bun", framework:"SvelteKit 2", ...}` | — |
| `showcase:ttl:verification-code` | string | `"V10R-8X2K"` | 300s |
| `showcase:ttl:flash-message` | string | `"Database reseeded successfully."` | 30s |
| `showcase:ttl:session-token` | string | `"ses_demo_abc123def456"` | 3600s |
| `showcase:counter:page-views` | string (number) | `1500000` | — |
| `showcase:counter:api-calls-today` | string (number) | `4200` | — |
| `showcase:hash:feature-flags` | hash | `{dark_mode:"1", beta_ui:"0", cache_showcase:"1", graph_viz:"1", ai_chat:"0"}` | — |
| `showcase:hash:user-prefs` | hash | `{theme:"system", language:"en", page_size:"25", notifications:"true"}` | — |
| `showcase:leaderboard:tech-popularity` | sorted set | Svelte:95, PostgreSQL:92, Bun:88, UnoCSS:85, Drizzle:82, Neo4j:78, Valibot:75, Threlte:70 | — |
| `showcase:queue:recent-events` | list | 5 event strings | — |

3. Return `{ keyCount }` from final `redis.keys()` count

Mirrors: `src/lib/server/store/showcase/seed.ts`, `src/lib/server/graph/showcase/seed.ts`

#### 2c. `showcase/queries.ts`

Three sections (one per route page):

**Connection page:**
- `verifyConnection()` — PING + keys('showcase:*') count + latency

**Patterns page:**
- `listShowcaseEntries()` — KEYS → parallel TYPE + TTL for each key
- `getEntryDetail(key)` — TYPE → type-specific read (GET / HGETALL / LRANGE / ZRANGE with scores / SMEMBERS)
- `getShowcaseStats()` — count by type

**Ephemeral page:**
- `getTtlSnapshot(key)` — TTL command → formatted snapshot
- `checkRateLimit(identifier, limit, windowSeconds)` — `@upstash/ratelimit` sliding window

#### 2d. `showcase/mutations.ts`

All mutations call `assertShowcaseKey()` first.

| Function | Redis Command | Returns |
|----------|---------------|---------|
| `setString(key, value, ttl?)` | SET [EX] | void |
| `deleteKey(key)` | DEL | void |
| `incrementCounter(key, amount?)` | INCRBY | number |
| `decrementCounter(key, amount?)` | DECRBY | number |
| `setHashField(key, field, value)` | HSET | void |
| `deleteHashField(key, field)` | HDEL | void |
| `addToSortedSet(key, member, score)` | ZADD | void |
| `removeFromSortedSet(key, member)` | ZREM | void |
| `pushToList(key, value, side)` | LPUSH / RPUSH | void |
| `popFromList(key, side)` | LPOP / RPOP | string or null |
| `setTtl(key, seconds)` | EXPIRE | void |
| `removeTtl(key)` | PERSIST | void |
| `slideTtl(key, seconds)` | TTL → conditional EXPIRE | number (new TTL) |

---

### Step 3: Route Pages

#### 3a. Update DB hub: `src/routes/showcases/db/+page.svelte`

Add fourth `LinkCard`:
- Icon: `i-lucide-zap`
- Title: "Cache"
- Description: Redis key-value store — TTL, counters, rate limiting
- Href: `/showcases/db/cache`

#### 3b. Cache hub: `src/routes/showcases/db/cache/+page.svelte`

- `PageHeader` — title "Cache", description, breadcrumbs (Home → Showcases → Database → Cache)
- Three `LinkCard`s: Connection, Patterns, Ephemeral
- `BackLink` → `/showcases/db`
- Mirror: `src/routes/showcases/db/storage/+page.svelte`

#### 3c. Connection: `src/routes/showcases/db/cache/connection/`

**+page.server.ts**
- `measureConnection()` — wraps `verifyConnection()` with `performance.now()` timing + error handling
- `load` → `measureConnection()`
- Actions: `retest` (re-measure), `reseed` (reseedCache → success/message)
- Mirror: `src/routes/showcases/db/storage/connection/+page.server.ts`

**+page.svelte**
- Status card: connection badge, latency, latency history badges (last 5)
- Instance info card: key count, endpoint (truncated to first 6 chars)
- Latency tiers: Fast (<50ms), Normal (50-200ms), Degraded (>200ms)
- Reseed button + ConfirmDialog
- Error card if disconnected (env var checklist)
- Mirror: `src/routes/showcases/db/storage/connection/+page.svelte`

#### 3d. Patterns: `src/routes/showcases/db/cache/patterns/`

**+page.server.ts**
- `load` → `listShowcaseEntries()` + `getShowcaseStats()` with timing
- Actions: `inspect`, `setString`, `deleteEntry`, `increment`, `decrement`, `setField`, `deleteField`, `addMember`, `removeMember`, `pushItem`, `popItem`

**+page.svelte**
- `SectionNav`: Overview, Strings, Hashes, Counters, Sorted Sets, Lists
- **Overview**: Stats grid + full entry table (key, type badge, TTL, inspect button)
- **Strings**: GET/SET form with key/value/TTL inputs, JSON viewer for values
- **Hashes**: Feature flags as toggle rows, user prefs as editable key-value pairs
- **Counters**: Large number display with +/- buttons, live updates
- **Sorted Sets**: Leaderboard table sorted by score, add/remove member forms
- **Lists**: Queue visualization with push (left/right) and pop (left/right) buttons
- Mirror: `src/routes/showcases/db/graph/model/+page.svelte`

#### 3e. Ephemeral: `src/routes/showcases/db/cache/ephemeral/`

**+page.server.ts**
- `load` → list TTL entries (showcase:ttl:* keys with their TTL snapshots)
- Actions: `createTtl`, `checkTtl`, `refreshTtl`, `rateCheck`

**+page.svelte**
- `SectionNav`: TTL Countdown, Sliding Expiry, Rate Limiting, Cache vs DB
- **TTL Countdown**: Cards for each TTL entry showing remaining seconds (formatted), create-with-TTL form
- **Sliding Expiry**: "Access" button that resets TTL, before/after comparison display
- **Rate Limiting**: "Send Request" button with remaining/limit gauge, uses `@upstash/ratelimit`
- **Cache vs DB**: Educational comparison table (when to use each paradigm — no interactive elements)
- Mirror: `src/routes/showcases/db/graph/traversal/+page.svelte`

---

### Step 4: Documentation

#### 4a. New: `docs/stack/data/redis.md`
Technology decision doc covering: why Redis, why Upstash, HTTP transport, free tier, principle evaluation, gotchas. Same format as `docs/stack/data/neo4j.md`.

#### 4b. Update: `docs/stack/data/README.md`
Add redis.md entry to the topic table.

---

## File Summary

### New Files (16)

```
src/lib/server/cache/index.ts
src/lib/server/cache/errors.ts
src/lib/server/cache/types.ts
src/lib/server/cache/showcase/guards.ts
src/lib/server/cache/showcase/seed.ts
src/lib/server/cache/showcase/queries.ts
src/lib/server/cache/showcase/mutations.ts
src/routes/showcases/db/cache/+page.svelte
src/routes/showcases/db/cache/connection/+page.server.ts
src/routes/showcases/db/cache/connection/+page.svelte
src/routes/showcases/db/cache/patterns/+page.server.ts
src/routes/showcases/db/cache/patterns/+page.svelte
src/routes/showcases/db/cache/ephemeral/+page.server.ts
src/routes/showcases/db/cache/ephemeral/+page.svelte
docs/stack/data/redis.md
```

### Modified Files (3)

```
package.json                              # add @upstash/redis, @upstash/ratelimit
src/routes/showcases/db/+page.svelte      # add Cache LinkCard
docs/stack/data/README.md                 # add redis.md entry
```

---

## Verification

1. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env`
2. Add dependencies to `package.json`, rebuild container (`podman compose up --build`)
3. Navigate to `/showcases/db` — Cache card appears in the grid
4. `/showcases/db/cache/connection` — PING succeeds, latency displayed, reseed populates keys
5. `/showcases/db/cache/patterns` — all 6 data type sections display seed data, mutations work
6. `/showcases/db/cache/ephemeral` — TTL countdown ticks, sliding expiry resets, rate limiter throttles
7. `bun run check` — no TypeScript errors
