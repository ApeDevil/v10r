# Data Velocity

Getting the answer from the cheapest place that is still correct, and not asking for it more
often than the answer changes.

Live showcase: `/showcases/velocity/data`

## Hierarchical cache

**Problem.** The same expensive answer is computed again for every reader.

**The hierarchy.** Read outward from the cheapest tier. Not every value uses every tier, and
nothing here is automatic.

```text
UI / local component state
        ↓
browser persistent storage
        ↓
HTTP / CDN cache
        ↓
process-local memory      ← CacheTier 'local'
        ↓
distributed cache (Redis) ← CacheTier 'shared'
        ↓
read model
        ↓
canonical datastore       ← CacheTier 'origin'
```

**Use when** reads substantially outnumber writes, the result is expensive and reused, and
bounded staleness is acceptable.

**Do not use when** the data changes constantly, correctness needs a strongly current value,
the computation is already cheap, or the invalidation complexity would exceed the work saved.
Adding a cache because a cache exists is how a system acquires a second source of truth.

**Key identity is the security boundary.** A key must encode every input that changes the
answer, or the cache serves one caller's result to another. That is not a performance bug, it
is a data leak, which is why `cacheKey` refuses two things outright:

| Mistake | Refused because |
|---|---|
| a `per-user` policy with no owner | one key would answer every user |
| a `shared` policy handed an owner | the scope is wrong, not the key — a personal value would be parked where everyone reads |

The second is the more dangerous, and the more common.

**Freshness ownership.** `ttl` is how long the value is the truth; `staleFor` is how much
longer it may be served while a refresh runs. Both live on the policy, next to the namespace
they govern, because a staleness window argued at each call site is one nobody can state.
`staleFor` defaults to `0`: serving stale is a decision about correctness, not a default to
inherit.

**Why the envelope carries its own TTL.** Redis expiry is a floor — it reclaims memory. The
stored envelope is what decides *fresh*, and it has to survive the value being read out of
the local tier where Redis TTL does not exist. Per-key jitter is applied there so a burst of
keys written together does not expire together; synchronised expiry is how a cache becomes a
stampede.

**Per-user values skip the local tier by default.** The tier is correct there — keys carry the
owner — but a warm serverless instance would accumulate one entry per user it happened to
serve, which is memory pressure bought for a hit rate personal data rarely has.

**Failure behaviour.** With no Redis configured, every shared read is a miss and every write
is a no-op. A miss is always correct, only slower — which is why this degrades silently where
the rate limiter, guarding something that breaks when unbounded, must not.

**Invariants.**

- Every cache entry has a declared owner and scope.
- Cache keys represent all inputs affecting the result.
- Sensitive user data never crosses a cache scope.
- Invalidation behaviour is explicit.
- The local tier is bounded (`LOCAL_MAX_ENTRIES`), oldest-used evicted first.

**Implementation.** `src/lib/server/cache/tiered.ts`, tests in `tiered.test.ts`.

## Stale-while-revalidate

**Problem.** A value is slightly out of date and the reader is made to wait for it to be made
current.

**Depends on** [hierarchical cache](#hierarchical-cache).

**Architecture.** `readThrough` resolves one of four ways, and the caller can tell which from
`tier` and `stale`:

| Outcome | Behaviour |
|---|---|
| fresh hit | inside TTL, returned as-is |
| stale hit | past TTL, inside the stale window — returned **immediately**, refresh started behind the response |
| miss | computed, coalesced so a burst rebuilds once, then stored |
| stale-if-error | the origin failed and a stale value exists, so the stale value keeps being served |

**Use when** slightly stale is better than waiting: dashboards, feeds, metadata, public
content, aggregate counts, search suggestions.

**Do not use for** authorization, account security state, balances requiring strong
consistency, or destructive-action validation. A stale permission is a wrong permission, and
this module cannot tell the difference — the call site can, which is why the policy lives
there.

**The refresh goes through `deferAfterResponse`,** not a dangling promise. On Vercel the
instance can be frozen the moment the response returns, and a refresh silently killed halfway
leaves the value stale forever with clean logs.

**Invariants.**

- The staleness window is explicit per policy.
- A stale value is never mistaken for authoritative security state.
- Revalidation never blocks the stale response.
- A cold miss with a failing origin throws — there is no honest answer but the error.

**Measurement.** `/showcases/velocity/data` writes one value under two policies — one with
a stale window, one without — waits out a real 1s TTL, then reads both. The strict policy
recomputes on the reader's time; the lenient one returns the stale value with no origin call
at all and hands its refresh to `deferAfterResponse`.

**Implementation.** `src/lib/server/cache/swr.ts`, tests in `swr.test.ts`.

## Singleflight / stampede protection

**Problem.** A cache expiry is a synchronised event. A thousand requests arriving after it do
not find a slow cache — they find no cache, and each independently rebuilds the same value
against the same upstream, at the moment that upstream is least able to take it.

```text
1000 misses → 1000 rebuilds        1000 misses → 1 rebuild → shared
```

**Depends on** [hierarchical cache](#hierarchical-cache).

**Two mechanisms, deliberately different promises.**

`coalesce` is in-process: concurrent callers for one key share one promise. This is where the
thousand-to-one collapse actually happens, because a burst lands on an instance, not on a
cluster. Followers get the leader's result *including its rejection*, so nobody silently
receives a different answer than the caller that did the work. Entries drop on settle — this
deduplicates, it does not memoize.

`claimRefresh` is cross-instance: one instance wins the right to refresh a key and the others
do not bother. **Used only on the stale-while-revalidate path**, where losing means "someone
else is refreshing, keep serving stale" — never on a cold miss.

**That restriction is the design.** A lock a cold caller waits on turns a slow dependency into
a queue and one failed leader into an outage. The invariant "stampede protection must not
introduce unbounded waiting" is satisfied here by never making anyone wait: a loser with
nothing to serve computes, and duplicate work beats a stalled request.

**Invariants.**

- Only equivalent work is coalesced (same key, same intent).
- The lock always carries an expiry, so a leader that dies blocks the next refresh for at most
  `RECLAIMABLE_AFTER_SECONDS`, not forever.
- A Redis failure lets the refresh proceed — the alternative is a value ageing with nobody
  allowed to renew it.
- TTL jitter (in `tiered.ts`) is the other half: it stops sibling keys expiring together.

**Implementation.** `src/lib/server/cache/singleflight.ts`, tests in `singleflight.test.ts`.

## No-waterfall data loading

**Problem.** Independent operations execute sequentially because `await` reads that way.

> Independent work executes concurrently. Sequential waiting requires a real dependency.

```text
A → B → C → D  (400ms)          A ┐
                                B ┼→ combine  (100ms)
                                C ┤
                                D ┘
```

**Strategies, in order.** Eliminate the fetch; combine into one datastore query; batch
equivalent operations; run independent operations concurrently; cache repeated work.
Concurrency is fourth, not first — a round trip removed beats a round trip parallelised.

**Where v10r already does this.** `sessionPopulate` in `src/hooks.server.ts` runs the
revocation check and the grant lookup concurrently; they were serial, on every authenticated
request, despite being completely independent. The observability showcase loads its field and
lab halves with `Promise.all`. The retrieval pipeline runs its tiers concurrently and shows
the timing in `/showcases/ai/chatbot`.

**Invariants.**

- Independent awaits on latency-sensitive paths do not form accidental waterfalls.
- N+1 access patterns do not exist on hot paths.
- Parallelization stays bounded where fan-out could overload a dependency — `Promise.all` over
  an unbounded list is a load test aimed at your own database.

**Measurement.** `/showcases/velocity/data` runs four ~60 ms lookups both ways and reports
both the clock and the origin-call count. The counts are identical; only the waiting differs.

## Screen read model

**Problem.** A screen rebuilds the same projection from many domain sources on every request.

**Use when** one view repeatedly needs several tables, graph data, counts, permissions,
metadata and aggregates at once — dashboards, workspaces, feeds, complex editors, search
results.

**Do not use when** the screen is trivial or a direct query already answers it. A read model
that is not carrying real join cost is a second source of truth bought for nothing.

```text
canonical writes → source of truth → projection → optimized read model → screen
```

**Where v10r already does this.** `analytics.aggregates` (rollups the dashboards read instead
of scanning `analytics.events`), the Neo4j catalog projection built by `db:catalog-sync`, and
the per-locale prerendered search index shards.

**Invariants.**

- Canonical state remains identifiable — the read model is derived, and says so.
- Projection freshness guarantees are documented.
- A rebuild/recovery path exists.
- Read models do not become accidental second sources of truth.

**Implementation.** `src/lib/server/db/analytics/`, `src/lib/server/search/catalog-projection.ts`,
`scripts/db/catalog-sync.ts`.

## Query budget and hot-query proof

**Problem.** Datastore latency is discussed rather than measured, index assumptions go
unverified until production, and N+1 is argued from a code reading instead of a count.

**Use for** any important user-facing path touching Postgres, Neo4j, Redis, a search index or
an external store.

**What a budget states**: maximum round trips, maximum *sequential* round trips, a p95 target,
whether N+1 is permitted (it is not), and which index is expected to be used. Numbers should
be evidence-based and configurable, never globally hardcoded.

### Counting is not proving

A round-trip counter and an N+1 detector look like the same tool and are not, and conflating
them produces a detector that cries wolf.

**N+1 is a claim about two data sizes.** It is not "this statement ran twice" — two identical
lookups may both be legitimate. It is "the number of statements grew with the number of rows",
and no amount of inspecting a single request can settle that, because a request has exactly
one row count. So the two halves are built separately and neither pretends to be the other:

| | Where | What it can say |
|---|---|---|
| Runtime census | `queryCensus` handler, third in `sequence()` | "this request made 47 queries" — a tripwire |
| Gate | `query-budget.gate.pglite.test.ts` | "this operation costs the same at 3 rows and at 30" — a proof |

The census is fed by Drizzle's `logger`, which is the only seam that sees every statement from
every domain — including Better Auth's session lookup, which is the request's least visible
query precisely because nobody wrote it. It counts round trips and not milliseconds: the
logger fires *before* execution and carries no duration, and `EXPLAIN ANALYZE` answers "why is
this query slow" far better than a wall clock wrapped around a network call would.

Outside a census scope, `observeQuery` is one `AsyncLocalStorage` lookup and a return, which
is what makes it acceptable to leave the driver's logger wired up permanently.

### The registered operations

`query-budget.ts` declares the operations somebody decided to defend, with the round trips
each may make **at any row count**:

| Operation | Budget | What the round trips are |
|---|---|---|
| `blog.listPosts` | 5 | count + page, then revisions + tags + domains batched by the fetched ids |
| `desk.listFiles` | 2 | one page read and one count, issued together |
| `desk.listFolders` | 1 | a single capped read; the tree is assembled in memory |
| `desk.countFolderContents` | 2 | subfolder count and file count in one wave |

Every number is what the gate measured on the day it was accepted, not an estimate. The gate
runs each operation over a 3-row and a 30-row fixture and requires the counts to **match** —
the flat count is the assertion that carries; the budget is the weaker second one, catching an
operation that quietly acquires a sixth round trip which happens not to scale.

Registration is deliberate and partial. An operation absent from that table is one nobody has
measured, never one that is known to be fine.

**The gate contains its own control.** A detector that has never seen a failure is not known to
work, so the file ends with a deliberately N+1 access pattern and requires the census to catch
it. If that case ever passes by reporting a flat count, everything above it is measuring
nothing.

### Proving the plan, not just the count

A flat count says nothing about whether the one query is cheap. `scripts/perf/db-explain.ts`
runs `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` over the hot queries against the real corpus, checks
HNSW index presence and the `iterative_scan` GUC, and uses a synthetic zero vector so a probe
run does not burn a Gemini embedding.

It also scores `vector_query_ms`, which sat in `budgets.json` with nothing producing a number
for it — the weakest kind of budget, one that can never be missed. The figure comes free:
`EXPLAIN ANALYZE` already reports the executor's own `Execution Time`. A vector query that
fell back to a sequential scan is reported as *the* finding, ahead of its milliseconds: that is
an unused index, not a slow query, and the two have different fixes.

The verdict is **reported, never enforced**. This probe runs by hand against a shared
serverless database that suspends after five minutes; a target that fails a build because Neon
was cold is a target nobody keeps.

**Invariants.**

- A hot query has evidence explaining why it is acceptable.
- N+1 access is forbidden on latency-sensitive paths — and forbidden by measurement, not by review.
- A performance fix does not rest on an assumed index.
- A budget number is what was measured, not what was hoped.

**Implementation.** `src/lib/server/db/query-census.ts`, `query-budget.ts`,
`query-budget.gate.pglite.test.ts`, the `queryCensus` handler in `src/hooks.server.ts`,
`scripts/perf/db-explain.ts`, `src/lib/server/perf/budgets.json`.
