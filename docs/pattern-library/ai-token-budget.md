---
title: "AI daily token budget"
description: "A per-user daily token cap stored in Redis that prevents a single authenticated user from exhausting AI quota through cost-amplification abuse."
category: "Anti-Abuse"
---

# AI daily token budget

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Anti-Abuse · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — governs AI cost exposure; misconfiguration can allow spend amplification

A per-user daily token cap stored in Redis that prevents a single authenticated user from exhausting AI quota through cost-amplification abuse.

**When to use:** Apply it to any AI-backed feature where per-user spend must be bounded before a request is served.

**Needs:** required key-value-store, llm-provider

## Docs

- [docs/blueprint/abuse/ai-budget.md](/docs/blueprint/abuse/ai-budget) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/ai-budget.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/ai-budget.md))

## Code

- `src/lib/server/ai/budget.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/budget.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/budget.ts))

## Proof

- [`/showcases/abuse/ai-budget`](/showcases/abuse/ai-budget)

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `ai-token-budget` in `pattern-library/registry.json`._
