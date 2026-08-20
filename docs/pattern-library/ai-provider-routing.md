---
title: "Provider registry & routing (chat/tools/vision + circuit breaker)"
description: "Resolver functions pick an active chat, tool-calling, or vision LLM provider per turn and trip a Redis-backed circuit breaker on rate-limited providers."
category: "AI"
---

# Provider registry & routing (chat/tools/vision + circuit breaker)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external LLM providers with quota limits

Resolver functions pick an active chat, tool-calling, or vision LLM provider per turn and trip a Redis-backed circuit breaker on rate-limited providers.

**When to use:** Use when an app must route between multiple LLM providers by capability and needs cross-instance cooldown on failures.

## Docs

- [docs/blueprint/ai/provider-routing.md](/docs/blueprint/ai/provider-routing) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/provider-routing.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/provider-routing.md))

## Code

- `src/lib/server/ai/providers.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/providers.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/providers.ts))

## Tests

- `src/lib/server/ai/providers.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/providers.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/providers.test.ts))

---

_Machine-readable record: `ai-provider-routing` in `mcp/patterns.registry.json`._
