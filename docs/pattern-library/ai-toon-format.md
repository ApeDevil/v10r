---
title: "TOON token-efficient context format"
description: "A compact, TOON-style serialization packs structured context data for LLM prompts more densely than JSON, currently implemented as a hand-rolled layout rather…"
category: "AI"
---

# TOON token-efficient context format

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** implemented · **Risk:** medium — external LLM providers with quota limits

A compact, TOON-style serialization packs structured context data for LLM prompts more densely than JSON, currently implemented as a hand-rolled layout rather than the external @toon-format/toon library.

**When to use:** Use when prompt context is large structured/tabular data and token budget for the call is tight.

## Docs

- [docs/blueprint/ai/toon.md](/docs/blueprint/ai/toon) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/toon.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/toon.md))

## Code

- `src/lib/server/ai/context/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/ai/context) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/ai/context))

---

_Machine-readable record: `ai-toon-format` in `mcp/patterns.registry.json`._
