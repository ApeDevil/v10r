# Velocity

Velocity is the architecture for removing latency, not a collection of micro-optimizations.
One idea holds it together:

> **Fast software does not make everything faster. It removes work from the user's wait.**

Everything below is a way of doing that, and the order matters — each rung is cheaper than
the one under it.

```text
Do not compute it
        ↓
Compute it once
        ↓
Compute it before it is requested
        ↓
Compute it close to the data or the user
        ↓
Compute independent work concurrently
        ↓
Cache the result
        ↓
Respond optimistically where safe
        ↓
Defer non-critical work
```

Live showcase: `/showcases/velocity` · measurement surfaces: `/showcases/observability`, `/admin/perf`

## Actual latency and perceived latency

Two different numbers, and optimizing only the first is how a backend gets fast while the
product still feels slow.

**Actual latency** is how long an operation takes: TTFB, a query, a round trip, a render.

**Perceived latency** is how long the user feels blocked.

```text
user presses Save
→ UI updates in 20 ms
→ server confirms in 350 ms
```

Actual mutation latency: 350 ms. Perceived interaction latency: ~20 ms. Both are real, and
[`interaction.md`](./interaction.md) is mostly about the second one.

## Critical, deferred, background

The vocabulary the rest of these documents use. Getting a piece of work into the right
category is usually a bigger win than making it faster.

| Class | Definition | Examples |
|---|---|---|
| **Critical** | Must complete before the requested result can safely be returned | authentication, authorization, validation, the canonical write, data the first render needs |
| **Deferred** | Should happen soon; the user does not wait for it | analytics, search indexing, notifications, derived metadata, embeddings |
| **Background** | Not attached to this response's lifecycle at all | exports, media processing, AI enrichment, cleanup, expensive projections |

Only genuinely required work belongs on the critical path. The mechanism is
[`deferAfterResponse`](./runtime.md#critical-path--deferred-tail); the judgement is per call
site and cannot be automated.

Note the word *path* here is prose. In code the terms are `criticalWork` / `deferredWork` /
`backgroundWork` — `path` already means a file, URL or graph path (`docs/naming.md`).

## Stability is part of speed

A dependency that occasionally takes 20 seconds makes an application slow even when its
average is 100 ms. Velocity optimizes p75, p95, p99 and tail behaviour — not averages.

```text
predictable 250 ms
```

usually beats

```text
usually 80 ms, occasionally 15 s
```

Which is why resilience lives inside this family rather than beside it.

## Instantiate the smallest set that is justified

Performance architecture creates complexity, and complexity that buys nothing is a cost. The
category exists to be *selected from*, not adopted wholesale.

| Application shape | Likely needs | Does **not** automatically need |
|---|---|---|
| Static marketing site | asset delivery, intent preloading, bundle quarantine, performance budgets | Redis, singleflight, read models, optimistic mutation, tracing |
| CRUD SaaS | optimistic mutation, hierarchical cache, critical/deferred tail, query budgets, latency tracing | read models, deadline propagation |
| Dense workspace | most of the family | — |
| AI-heavy | plus deadline propagation, circuit breakers, bulkheads, load shedding, singleflight, background execution | — |

## The decision hierarchy

When something is slow, work down this list. It is deliberately ordered to discourage
reaching for a technology before understanding a number.

1. Measure where the time goes.
2. Remove unnecessary work.
3. Remove unnecessary round trips.
4. Remove sequential dependencies.
5. Reduce the amount of data or work.
6. Cache reusable results.
7. Move predictable work earlier.
8. Move non-critical work later.
9. Move compute closer to its dependencies.
10. Isolate heavy client work.
11. Add specialized technology only once measurement justifies it.

## Invariants

The category-level ones. Each document adds its own.

- **No operation may make the user wait for work that is unnecessary to satisfy the user's immediate intent.**
- Independent work does not wait sequentially.
- Reusable work is not unnecessarily recomputed.
- Optional capabilities do not contaminate critical bundles or critical paths.
- Slow dependencies have bounded impact.
- Performance claims require measurement.
- Performance mechanisms never compromise correctness, security or architectural boundaries.
- A Velocity pattern is instantiated only when its complexity is justified.

## Libraries are implementation details

A pattern here describes an architecture, and names a mechanism only as one way to build it.
`hierarchical-cache` can be an HTTP cache, an in-memory LRU, Redis, or a browser cache — the
pattern is the tiering and the key discipline, not the vendor.

Before any dependency is added for a Velocity reason, it has to answer:

1. What architectural problem does it solve?
2. Is the capability already in Svelte, SvelteKit or the platform?
3. Does its cost justify the benefit?
4. Can it stay behind a v10r abstraction?
5. Should projects emulate the library, or only the pattern?

v10r's own answer so far is that none of this needed a new dependency. `latency-tracing` is
~120 lines over `performance.now()` and the `Server-Timing` header rather than
OpenTelemetry, because the adapter seam is the valuable part and the exporter is not.

## Related

- [interaction.md](./interaction.md) — what the user feels: optimistic mutation, preloading, virtualization, idle work
- [data.md](./data.md) — caching, staleness, stampedes, waterfalls, read models, query budgets
- [runtime.md](./runtime.md) — deferred tails, bundles, workers, assets, resilience, deadlines, locality
- [measurement.md](./measurement.md) — tracing, budgets and ratchets, the scenario harness
