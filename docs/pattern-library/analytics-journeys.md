---
title: "User journeys (client beacon)"
description: "Page-to-page journeys are computed in Postgres with a LEAD() window function over consecutive pageviews in a session and shown as a ranked table rather than…"
category: "Analytics"
---

# User journeys (client beacon)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — client beacon posts to a first-party endpoint only

Page-to-page journeys are computed in Postgres with a LEAD() window function over consecutive pageviews in a session and shown as a ranked table rather than an aggregate flow diagram.

**When to use:** Use when you need real per-visitor navigation paths without merging visitors with different journeys into one misleading diagram.

## Docs

- [docs/blueprint/analytics/activation.md](/docs/blueprint/analytics/activation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/analytics/activation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/analytics/activation.md))

## Code

- `src/lib/analytics/journey-beacon.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/analytics/journey-beacon.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/analytics/journey-beacon.ts))

## Proof

- [`/showcases/analytics/journeys`](/showcases/analytics/journeys)

---

_Machine-readable record: `analytics-journeys` in `mcp/patterns.registry.json`._
