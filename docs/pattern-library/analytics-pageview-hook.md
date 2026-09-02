---
title: "Pageview collector hook (last of 14 middleware stages)"
description: "A hooks.server.ts middleware stage that runs last in the 14-stage sequence and records public GET pageviews into separate anonymous and authenticated lanes…"
category: "Analytics"
---

# Pageview collector hook (last of 14 middleware stages)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — server-side telemetry write, no external service

A hooks.server.ts middleware stage that runs last in the 14-stage sequence and records public GET pageviews into separate anonymous and authenticated lanes only after auth and routing have resolved; sessions gain human_confirmed_at via a consent-free confirm ping so dashboards count JS-corroborated visitors, and collection is muted in dev because every environment shares one database.

**When to use:** Reach for it when first-party pageview logging needs to sit directly in the request hook chain instead of a third-party analytics script.

## Docs

- [docs/blueprint/analytics/activation.md](/docs/blueprint/analytics/activation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/analytics/activation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/analytics/activation.md))

## Code

- `src/lib/server/analytics/collector.hook.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/analytics/collector.hook.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/analytics/collector.hook.ts))

## Proof

- [`/showcases/analytics/overview`](/showcases/analytics/overview)

---

_Machine-readable record: `analytics-pageview-hook` in `pattern-library/registry.json`._
