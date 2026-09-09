---
title: "Performance scenario harness (adverse conditions, committed)"
description: "Representative paths driven under one adverse condition at a time — cold cache, expiry burst, hanging dependency, failing dependency, concurrency, refusal …"
category: "Velocity Measurement"
---

# Performance scenario harness (adverse conditions, committed)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Velocity Measurement · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — a measurement harness, not runtime code

Representative paths driven under one adverse condition at a time — cold cache, expiry burst, hanging dependency, failing dependency, concurrency, refusal — with the deterministic columns gated and the timings only reported. A system is not proven fast because localhost is fast.

**When to use:** Use once the obvious latency work is done and the remaining risk is behaviour under failure and load rather than in the happy path.

## Docs

- [docs/blueprint/velocity/measurement.md#performance-scenario-harness](/docs/blueprint/velocity/measurement) — The committed run, and which rows of the grid are still empty ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/measurement.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/measurement.md))

## Code

- `src/lib/server/perf/scenarios.ts` — Nine scenarios against the real mechanisms, plus the committed-run comparison ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/scenarios.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/scenarios.ts))
- `scripts/perf/scenarios.ts` — The door: spawns the gate in write mode, because the harness needs Vite to resolve $env ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/perf/scenarios.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/perf/scenarios.ts))

## Tests

- `src/lib/server/perf/scenarios.gate.test.ts` — Asserts the deterministic columns against the committed results; also the writer ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/scenarios.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/scenarios.gate.test.ts))

## Invariants

- Deterministic and reported columns are kept apart: origin counts and outcomes are asserted, latency never is.
- A scenario that cannot be measured reproducibly is reported, not gated — the same stance that keeps cold-start time off the ratchet list.
- The recorded numbers and the asserted numbers come from one code path, so the committed file cannot describe a run nobody checked.
- The harness runs without the shared cache tier, so a lab measurement never depends on whether a network service was reachable.
- Uncovered conditions are named rather than left blank — a grid with unstated gaps reads as full coverage.

## Emulation notes

- Split every result into a column a machine can assert and a column only a human can read. Gating latency on a shared runner is how a performance suite becomes a flaky suite and then a deleted one.
- Make one condition adverse per scenario. Two at once produces a number nobody can attribute, which is the failure mode of most load tests.
- Commit the results the way a bundle snapshot is committed. The value is the diff: a behaviour change then arrives as a reviewed line rather than as a number that quietly moved.
- Give the patterns with no demonstrable UI their only proof here. Load shedding's success looks like nothing happening, so a scenario row is what an honest measurement of it actually is.
- Drive the REAL mechanisms. A harness that reimplements the pattern proves the harness works; if the runtime cannot load the real modules, fix the runtime rather than the scope.

## Depends on

- [Performance budget and ratchet (targets aspire, ceilings hold)](/docs/pattern-library/performance-budget-ratchet)
- [Resilience policy (breaker, bulkhead, shedding, bounded retry)](/docs/pattern-library/resilience-policy)

---

_Machine-readable record: `scenario-harness` in `pattern-library/registry.json`._
