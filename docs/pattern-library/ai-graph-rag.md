---
title: "Graph RAG pipeline (three tiers, RRF fusion)"
description: "Vector-similarity chunk retrieval is combined with Neo4j knowledge-graph traversal across three parallel tiers, fused by reciprocal rank fusion, for more…"
category: "AI"
---

# Graph RAG pipeline (three tiers, RRF fusion)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Risk:** medium — external LLM providers with quota limits

Vector-similarity chunk retrieval is combined with Neo4j knowledge-graph traversal across three parallel tiers, fused by reciprocal rank fusion, for more explainable answers.

**When to use:** Use when vector search alone misses multi-hop relationship queries that a knowledge graph can answer.

## Docs

- [docs/blueprint/ai/graph-rag.md](/docs/blueprint/ai/graph-rag) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/graph-rag.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/graph-rag.md))

## Code

- `src/lib/server/rawrag/tiers/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/rawrag/tiers) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/rawrag/tiers))
- `src/lib/server/graph/rag/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/graph/rag) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/graph/rag))

## Proof

- [`/showcases/ai/retrieval/rag-chat`](/showcases/ai/retrieval/rag-chat)

---

_Machine-readable record: `ai-graph-rag` in `mcp/patterns.registry.json`._
