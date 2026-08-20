---
title: "Chatbot site awareness (page context)"
description: "Server-resolved page context is injected as a passive block into the chatbot's prompt so deictic questions like \"how does this work?\" resolve to the page the…"
category: "AI"
---

# Chatbot site awareness (page context)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** implemented · **Risk:** medium — external LLM providers with quota limits

Server-resolved page context is injected as a passive block into the chatbot's prompt so deictic questions like "how does this work?" resolve to the page the user is viewing.

**When to use:** Use when a floating assistant needs to ground answers in whatever public page the user currently has open.

## Docs

- [docs/blueprint/ai/site-awareness.md](/docs/blueprint/ai/site-awareness) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/site-awareness.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/site-awareness.md))

## Code

- `src/lib/server/search/page-context.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/search/page-context.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/search/page-context.ts))

---

_Machine-readable record: `ai-site-awareness` in `mcp/patterns.registry.json`._
