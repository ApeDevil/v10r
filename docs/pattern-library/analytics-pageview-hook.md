---
title: "Pageview collector hook (last of 12 middleware stages)"
description: "A hooks.server.ts middleware stage that runs last in the 12-stage sequence and records public GET pageviews into separate anonymous and authenticated lanes…"
category: "Analytics"
---

# Pageview collector hook (last of 12 middleware stages)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Risk:** low — server-side telemetry write, no external service

A hooks.server.ts middleware stage that runs last in the 12-stage sequence and records public GET pageviews into separate anonymous and authenticated lanes only after auth and routing have resolved.

**When to use:** Reach for it when first-party pageview logging needs to sit directly in the request hook chain instead of a third-party analytics script.

## Docs

- [docs/blueprint/analytics/activation.md](/docs/blueprint/analytics/activation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/analytics/activation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/analytics/activation.md))

## Code

- `src/lib/server/analytics/hook.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/analytics/hook.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/analytics/hook.ts))

## Proof

- [`/showcases/analytics/overview`](/showcases/analytics/overview)

---

_Machine-readable record: `analytics-pageview-hook` in `mcp/patterns.registry.json`._
