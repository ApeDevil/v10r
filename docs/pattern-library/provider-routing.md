---
title: "Provider registry & routing"
description: "Resolver functions pick an active chat, tool-calling, or vision LLM provider per turn and trip a Redis-backed circuit breaker on rate-limited providers."
category: "AI"
---

# Provider registry & routing

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external LLM providers with quota limits

Resolver functions pick an active chat, tool-calling, or vision LLM provider per turn and trip a Redis-backed circuit breaker on rate-limited providers.

**When to use:** Use when an app must route between multiple LLM providers by capability and needs cross-instance cooldown on failures.

**Needs:** required llm-provider · conditional key-value-store (when breaker state must be shared across instances; via resilience-policy)

## Docs

- [docs/blueprint/ai/provider-routing.md](/docs/blueprint/ai/provider-routing) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/provider-routing.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/provider-routing.md))

## Code

- `src/lib/server/ai/providers.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/providers.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/providers.ts))

## Tests

- `src/lib/server/ai/providers.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/providers.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/providers.test.ts))

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Resilience policy](/docs/pattern-library/resilience-policy) — Rate-limited providers trip a circuit breaker so the resolver routes around them; any breaker satisfies it.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `provider-routing` in `pattern-library/registry.json`._
