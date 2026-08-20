---
title: "Cost & usage monitoring"
description: "Chat and image telemetry are merged into one admin table that derives a reference token cost at read time from a hand-maintained price table, without charging…"
category: "AI"
---

# Cost & usage monitoring

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — read-only admin reporting over existing telemetry

Chat and image telemetry are merged into one admin table that derives a reference token cost at read time from a hand-maintained price table, without charging or faking a real bill.

**When to use:** Use when multiple AI surfaces need a single cross-surface view of token usage and reference spend.

## Docs

- [docs/blueprint/ai/cost-monitoring.md](/docs/blueprint/ai/cost-monitoring) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/cost-monitoring.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/cost-monitoring.md))

## Code

- `src/lib/server/ai/pricing.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/pricing.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/pricing.ts))
- `src/lib/server/ai/usage-summary.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/usage-summary.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/usage-summary.ts))

## Proof

- [`/admin/ai`](/admin/ai) (app route, no showcase)

---

_Machine-readable record: `ai-cost-monitoring` in `mcp/patterns.registry.json`._
