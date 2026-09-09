---
title: "Query budget and N+1 proof (counting is not proving)"
description: "Database round trips counted per request by the driver's own logger, and per operation by a gate that runs each one over two data sizes — because N+1 is a…"
category: "Data Velocity"
---

# Query budget and N+1 proof (counting is not proving)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Data Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — measurement and gating only; the runtime census changes no behaviour

Database round trips counted per request by the driver's own logger, and per operation by a gate that runs each one over two data sizes — because N+1 is a claim about how cost SCALES, which no single request can settle.

**When to use:** Use on any user-facing path that touches a datastore, and on every list endpoint without exception.

## Docs

- [docs/blueprint/velocity/data.md#query-budget-and-hot-query-proof](/docs/blueprint/velocity/data) — Why the runtime census is a tripwire and only the gate is a proof ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/data.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/data.md))

## Code

- `src/lib/server/db/query-census.ts` — AsyncLocalStorage-scoped counter fed by Drizzle's logger; shape normalization collapses parameter lists ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/query-census.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/query-census.ts))
- `src/lib/server/db/query-budget.ts` — The registered operations and their measured round-trip budgets ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/query-budget.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/query-budget.ts))
- `scripts/perf/db-explain.ts` — EXPLAIN ANALYZE over the hot queries; scores vector_query_ms from the executor's own timing ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/perf/db-explain.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/perf/db-explain.ts))

## Tests

- `src/lib/server/db/query-budget.gate.pglite.test.ts` — Two data sizes per operation, plus a deliberately N+1 control ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/query-budget.gate.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/query-budget.gate.pglite.test.ts))
- `src/lib/server/db/query-census.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/query-census.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/query-census.test.ts))

## Invariants

- N+1 is defined by SCALING, not by repetition: the same statement twice may be two legitimate lookups, and only a second data size can tell them apart.
- A declared budget is the number that was measured on the day it was accepted, never an estimate.
- A registered operation costs the same number of round trips at any row count.
- Instrumentation is free when nobody is counting — outside a census scope the observer is one context lookup and a return.
- The absence of an operation from the registry means nobody measured it, never that it is fine.
- A vector query that fell back to a sequential scan is reported as an unused index, ahead of its milliseconds — the two have different fixes.

## Emulation notes

- Count at the DRIVER, not at the call sites. An ORM's logger hook is the only seam that sees every statement from every domain, including the session lookup nobody wrote and therefore nobody counts.
- Normalize parameter lists to one shape. `id IN ($1,$2,$3)` and `id IN ($1..$30)` are the same batched read, and a normalizer that told them apart would report every batch as new — exactly backwards, since batching is the fix.
- Count round trips, not milliseconds. A logger that fires before execution has no duration to give, and EXPLAIN ANALYZE answers "why is this slow" far better than a wall clock around a network call.
- Put the gate's control inside the gate. A detector that has never caught a failure is not known to work: include one deliberately N+1 access pattern and require the census to catch it.
- Wrap the counter ABOVE authentication in the middleware chain. Auth is the request's least visible query, and a counter that starts below it reports every request as cheaper than it was.
- Keep the per-request ceiling generous. It is a tripwire for the request that suddenly makes ninety queries, not a budget anyone is held to — those are per-operation and asserted where they can be proved.

## Depends on

- [Performance budget and ratchet (targets aspire, ceilings hold)](/docs/pattern-library/performance-budget-ratchet)

---

_Machine-readable record: `query-budget` in `pattern-library/registry.json`._
