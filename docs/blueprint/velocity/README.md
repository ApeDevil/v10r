# Velocity

The architecture for removing latency — actual and perceived — from an application, organised
so an agent can instantiate the smallest set a project actually justifies.

> Fast software does not make everything faster. It removes work from the user's wait.

Live showcase: `/showcases/velocity` · measurement surfaces: `/showcases/observability`, `/admin/perf`

Velocity's code lives in the modules that own each responsibility — `$lib/server/cache/`,
`$lib/server/http/`, `$lib/server/perf/`, `$lib/server/resilience/`, `$lib/state/`, `$lib/nav/`,
`$lib/components/primitives/virtual-list/`. There is no `velocity/` directory, because a
domain named after a quality attribute is a bucket, and buckets accumulate.

## Files

| File | Topics |
|------|--------|
| **[principles.md](./principles.md)** | • The optimization ladder and the decision hierarchy<br>• Actual vs perceived latency<br>• Critical / deferred / background vocabulary<br>• Category invariants; when NOT to instantiate a pattern<br>• Why libraries are implementation details |
| **[interaction.md](./interaction.md)** | • Optimistic mutation: fold-based rollback, idempotency keys, what must never be optimistic<br>• Intent-based preloading: six levels over SvelteKit's triggers<br>• Virtualized rendering: windowing maths, roving focus, uniform-height-only<br>• Idle and speculative work |
| **[data.md](./data.md)** | • Hierarchical cache: tiers, key identity as a security boundary, freshness ownership, TTL jitter<br>• Stale-while-revalidate and stale-if-error<br>• Singleflight: why a cold caller never waits on a lock<br>• No-waterfall loading<br>• Screen read models<br>• Query budgets: why counting is not proving, the registered operations, and the gate's own control |
| **[runtime.md](./runtime.md)** | • Critical path / deferred tail and the two platform facts behind `deferAfterResponse`<br>• Heavy dependency quarantine and the `baseline_js_kb` ratchet<br>• Main-thread budget: worker → WASM, measured<br>• Asset delivery<br>• Resilience policy: breaker (no half-open, and why), bulkhead (refuse, do not queue), load shedding, retry bounded by the request's budget<br>• Deadline propagation: one budget divided by `child()`, not repeated<br>• Compute and data locality: a derived region map, and the hops a request actually makes |
| **[measurement.md](./measurement.md)** | • Latency tracing: the v10r span API, `Server-Timing` as one renderer, `unattributed` as a floor<br>• Field / lab / development contexts, never merged<br>• Targets vs ratchets, and why a gate wired to a target gets muted<br>• The scenario harness: what the system does when conditions are not ideal, and which rows of the grid are still empty<br>• How to read the showcase's numbers honestly |
