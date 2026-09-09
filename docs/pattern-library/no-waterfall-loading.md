---
title: "No-waterfall data loading"
description: "Independent operations execute concurrently; sequential waiting requires a real dependency. The same round trips happen either way — only the waiting is…"
category: "Data Velocity"
---

# No-waterfall data loading

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Data Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — a reordering of awaits, with no contract change

Independent operations execute concurrently; sequential waiting requires a real dependency. The same round trips happen either way — only the waiting is removed, which is why the fix is free.

**When to use:** Use whenever one request needs several independent resources. Reach for it fourth, after removing the fetch, combining the query, and batching.

## Docs

- [docs/blueprint/velocity/data.md#no-waterfall-data-loading](/docs/blueprint/velocity/data) — The ordered strategies; concurrency is fourth, not first ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/data.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/data.md))

## Code

- `src/hooks.server.ts` — sessionPopulate runs the revocation check and grant lookup concurrently ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/hooks.server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/hooks.server.ts))
- `src/lib/server/showcases/velocity/measurements.ts` — The measured serial-vs-parallel comparison ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/velocity/measurements.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/velocity/measurements.ts))

## Tests

- `src/lib/server/showcases/velocity/measurements.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/velocity/measurements.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/velocity/measurements.test.ts))

## Proof

- [`/showcases/velocity/data`](/showcases/velocity/data)

## Invariants

- Independent awaits on latency-sensitive paths do not form accidental waterfalls.
- N+1 access patterns do not exist on hot paths.
- Parallelization stays bounded where fan-out could overload a dependency — `Promise.all` over an unbounded list is a load test aimed at your own database.

## Emulation notes

- Concurrency is the fourth strategy, not the first: eliminate the fetch, combine into one query, batch equivalent operations, and only then parallelise. A round trip removed beats a round trip parallelised.
- Measure the origin-call count alongside the clock. Parallelising changes the wall time and nothing else; the counts staying equal is the proof that no work was skipped.

---

_Machine-readable record: `no-waterfall-loading` in `pattern-library/registry.json`._
