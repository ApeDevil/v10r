---
title: "Screen read model"
description: "Frequently-read views are served from a purpose-built projection instead of rebuilding the same joins per request — analytics rollups, the Neo4j catalog…"
category: "Data Velocity"
---

# Screen read model

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Data Velocity · **Tier:** light · **Maturity:** implemented · **Risk:** medium — a projection that outlives its rebuild path becomes a second source of truth

Frequently-read views are served from a purpose-built projection instead of rebuilding the same joins per request — analytics rollups, the Neo4j catalog projection, and the per-locale prerendered search shards.

**When to use:** Use when one screen repeatedly needs several tables, counts, permissions and aggregates at once. Not for a screen a direct query already answers.

## Docs

- [docs/blueprint/velocity/data.md#screen-read-model](/docs/blueprint/velocity/data) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/data.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/data.md))

## Code

- `src/lib/server/db/analytics/` — Rollups the dashboards read instead of scanning events ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/analytics))
- `src/lib/server/search/catalog-projection.ts` — The Neo4j catalog projection ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/search/catalog-projection.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/search/catalog-projection.ts))

---

_Machine-readable record: `velocity-screen-read-model` in `pattern-library/registry.json`._
