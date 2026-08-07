---
title: "Funnels"
description: "Funnel conversion is computed as count(distinct session_id) per step in one grouped query, so a reload mid-funnel is deduped instead of double-counted."
category: "Analytics"
---

# Funnels

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Risk:** low — read-only aggregate query

Funnel conversion is computed as count(distinct session_id) per step in one grouped query, so a reload mid-funnel is deduped instead of double-counted.

**When to use:** Use when measuring step-by-step conversion through a defined sequence of pages or events.

## Docs

- [docs/blueprint/analytics/activation.md](/docs/blueprint/analytics/activation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/analytics/activation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/analytics/activation.md))

## Code

- `src/lib/server/db/analytics/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/analytics))

## Proof

- [`/showcases/analytics/funnels`](/showcases/analytics/funnels)

---

_Machine-readable record: `analytics-funnels` in `mcp/patterns.registry.json`._
