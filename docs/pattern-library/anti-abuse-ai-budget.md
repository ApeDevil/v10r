---
title: "AI daily token budget"
description: "A per-user daily token cap stored in Redis that prevents a single authenticated user from exhausting AI quota through cost-amplification abuse."
category: "Anti-Abuse"
---

# AI daily token budget

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Anti-Abuse · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — governs AI cost exposure; misconfiguration can allow spend amplification

A per-user daily token cap stored in Redis that prevents a single authenticated user from exhausting AI quota through cost-amplification abuse.

**When to use:** Apply it to any AI-backed feature where per-user spend must be bounded before a request is served.

## Docs

- [docs/blueprint/abuse/ai-budget.md](/docs/blueprint/abuse/ai-budget) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/ai-budget.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/ai-budget.md))

## Code

- `src/lib/server/ai/budget.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/budget.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/budget.ts))

## Proof

- [`/showcases/abuse/ai-budget`](/showcases/abuse/ai-budget)

---

_Machine-readable record: `anti-abuse-ai-budget` in `mcp/patterns.registry.json`._
