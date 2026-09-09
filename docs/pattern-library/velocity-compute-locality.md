---
title: "Compute and data locality"
description: "A locality map derived from the environment rather than typed into a table: which region each system runs in, which of them are not observable at all, and the…"
category: "Runtime Velocity"
---

# Compute and data locality

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Runtime Velocity · **Tier:** light · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — a locality change is a deployment change

A locality map derived from the environment rather than typed into a table: which region each system runs in, which of them are not observable at all, and the cross-region hops one request actually pays.

**When to use:** Use when the architecture contains remote databases, caches, object storage or AI providers — which is to say, almost always on serverless.

## Docs

- [docs/blueprint/velocity/runtime.md#compute-and-data-locality](/docs/blueprint/velocity/runtime) — Why the map is derived, and the open question it raises ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `src/lib/server/perf/locality.ts` — Region extraction that keeps the credential it was derived from out of its output ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/locality.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/locality.ts))
- `scripts/perf/locality.ts` — bun run perf:locality — the renderer ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/perf/locality.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/perf/locality.ts))

## Tests

- `src/lib/server/perf/locality.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/locality.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/locality.test.ts))

---

_Machine-readable record: `velocity-compute-locality` in `pattern-library/registry.json`._
