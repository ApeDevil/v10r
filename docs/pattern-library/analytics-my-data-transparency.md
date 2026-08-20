---
title: "Visitor \"my data\" transparency"
description: "An authenticated \"Your data\" page streams cookie state, live request metadata, and a full collectUserData report so a visitor can see what analytics has…"
category: "Analytics"
---

# Visitor "my data" transparency

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — read-only authenticated page, no external service

An authenticated "Your data" page streams cookie state, live request metadata, and a full collectUserData report so a visitor can see what analytics has captured about them.

**When to use:** Use when a product needs a self-service transparency/export view satisfying a GDPR Art. 15 access request.

## Docs

- [docs/stack/capabilities/gdpr.md](/docs/stack/gdpr) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/gdpr.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/gdpr.md))

## Code

- `src/lib/server/analytics/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/analytics))

## Proof

- [`/showcases/analytics/my-data`](/showcases/analytics/my-data)

---

_Machine-readable record: `analytics-my-data-transparency` in `mcp/patterns.registry.json`._
