---
title: "Chat assistant \"Vely\" (orchestrator, streaming)"
description: "The chat-orchestrator module streams multi-provider LLM responses through Vely, v10r's floating chat assistant, using Vercel AI SDK v6."
category: "AI"
---

# Chat assistant "Vely" (orchestrator, streaming)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external LLM providers with quota limits

The chat-orchestrator module streams multi-provider LLM responses through Vely, v10r's floating chat assistant, using Vercel AI SDK v6.

**When to use:** Reach for it when a product needs a streaming, tool-capable chat UI backed by interchangeable LLM providers.

## Docs

- `docs/blueprint/ai/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/README.md))
- [docs/stack/ai/ai-sdk.md](/docs/stack/ai-sdk) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/ai/ai-sdk.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/ai/ai-sdk.md))

## Code

- `src/lib/server/ai/chat-orchestrator.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/chat-orchestrator.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/chat-orchestrator.ts))
- `src/lib/components/composites/chatbot/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/chatbot) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/chatbot))

## Proof

- [`/showcases/ai/chatbot`](/showcases/ai/chatbot)

---

_Machine-readable record: `ai-chat-assistant` in `pattern-library/registry.json`._
