---
title: "Live events feed"
description: "An unauthenticated, self-limiting SSE stream at /api/analytics/stream pushes live event-style updates for the showcase demo, using synthetic rather than…"
category: "Analytics"
---

# Live events feed

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Risk:** low — unauthenticated but self-limited (per-IP rate, connection ceiling, hard timeout)

An unauthenticated, self-limiting SSE stream at /api/analytics/stream pushes live event-style updates for the showcase demo, using synthetic rather than production data.

**When to use:** Use as a template for a rate-limited public SSE endpoint that streams live-looking activity without exposing real user data.

## Docs

- [docs/blueprint/analytics/activation.md](/docs/blueprint/analytics/activation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/analytics/activation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/analytics/activation.md))

## Code

- `src/lib/server/analytics/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/analytics))
- `src/routes/api/analytics/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/analytics))

## Proof

- [`/showcases/analytics/live`](/showcases/analytics/live)

---

_Machine-readable record: `analytics-live-feed` in `mcp/patterns.registry.json`._
