---
title: "Performance budget and ratchet (targets aspire, ceilings hold)"
description: "Two thresholds with different jobs: targets are where we want to be and never fail a build, ceilings are the measured value at the moment it was accepted and…"
category: "Velocity Measurement"
---

# Performance budget and ratchet (targets aspire, ceilings hold)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Velocity Measurement · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — measurement and gating only; no runtime behaviour

Two thresholds with different jobs: targets are where we want to be and never fail a build, ceilings are the measured value at the moment it was accepted and only ever move down. A gate wired to a target gets muted the afternoon it is added.

**When to use:** Use for any deterministic metric worth defending — shared JS, route JS, prerendered document weight, known expensive queries.

## Docs

- [docs/blueprint/velocity/measurement.md#performance-budget-and-ratchet](/docs/blueprint/velocity/measurement) — Targets vs ratchets, and the field/lab/dev split ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/measurement.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/measurement.md))
- [docs/stack/quality/performance.md](/docs/stack/performance) — The measurement contexts in full ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/quality/performance.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/quality/performance.md))

## Code

- `src/lib/server/perf/budgets.json` — The single source of truth for both kinds of threshold ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/budgets.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/budgets.json))
- `src/lib/server/perf/budgets.ts` — Scoring, and why lab and field budgets cannot be shared ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/budgets.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/budgets.ts))

## Tests

- `src/lib/server/perf/snapshot.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/snapshot.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/snapshot.gate.test.ts))
- `src/lib/server/perf/budgets.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/budgets.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/budgets.test.ts))

## Proof

- [`/showcases/observability/budgets`](/showcases/observability/budgets)
- [`/showcases/observability/honesty`](/showcases/observability/honesty)

## Invariants

- Targets and regression gates stay distinct — a target may be red today, and saying so is the point.
- Ratchets move down, not up, except through explicit architectural review. Lowering a ceiling is how an improvement gets banked.
- Development measurements are never mixed with lab or production ones.
- A metric is only ratcheted when it is deterministic enough to be reproducible — which is why cold-start time is reported and not gated.
- A lab snapshot from a non-production build is refused rather than scored.

## Emulation notes

- Give ceilings a few percent of headroom over the measurement. Set exactly at the measured value, one ordinary feature trips the gate — and a gate that fails on ordinary work is a gate that gets muted. The headroom absorbs a feature and deliberately not a heavy dependency.
- Keep the thresholds in ONE file that both the application and the shell probes read. Two copies drift, and the copy that drifts is always the one the gate uses.
- Field and lab budgets for the same metric name are different numbers. Scoring a real-user p75 against a warm-preview budget reports a failure on every healthy deployment.

---

_Machine-readable record: `performance-budget-ratchet` in `pattern-library/registry.json`._
