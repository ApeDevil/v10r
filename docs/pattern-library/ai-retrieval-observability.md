---
title: "Retrieval observability (waterfall, explorer)"
description: "A waterfall/step-timeline view exposes the concurrent-tier timing, provenance paths, and token breakdown behind each nRAG retrieval turn."
category: "AI"
---

# Retrieval observability (waterfall, explorer)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Risk:** medium — external LLM providers with quota limits

A waterfall/step-timeline view exposes the concurrent-tier timing, provenance paths, and token breakdown behind each nRAG retrieval turn.

**When to use:** Use when developers or users need to inspect why a RAG answer was grounded the way it was, including per-tier timing and cost.

## Docs

- [docs/blueprint/ai/nrag-observability.md](/docs/blueprint/ai/nrag-observability) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/nrag-observability.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/nrag-observability.md))

## Code

- `src/lib/server/rawrag/queries.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/queries.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/queries.ts))

## Proof

- [`/showcases/ai/chatbot`](/showcases/ai/chatbot)

---

_Machine-readable record: `ai-retrieval-observability` in `mcp/patterns.registry.json`._
