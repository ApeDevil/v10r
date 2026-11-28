---
title: "Graph RAG pipeline"
description: "Vector-similarity chunk retrieval is combined with Neo4j knowledge-graph traversal across three parallel tiers, fused by reciprocal rank fusion, for more…"
category: "AI"
---

# Graph RAG pipeline

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external LLM providers with quota limits

Vector-similarity chunk retrieval is combined with Neo4j knowledge-graph traversal across three parallel tiers, fused by reciprocal rank fusion, for more explainable answers.

**When to use:** Use when vector search alone misses multi-hop relationship queries that a knowledge graph can answer.

**Needs:** required graph-db, llm-provider, relational-db, vector-search

## Docs

- [docs/blueprint/ai/graph-rag.md](/docs/blueprint/ai/graph-rag) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/graph-rag.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/graph-rag.md))

## Code

- `src/lib/server/retrieval/tiers/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/retrieval/tiers) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/retrieval/tiers))
- `src/lib/server/graph/retrieval/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/graph/retrieval) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/graph/retrieval))

## Proof

- [`/showcases/ai/chatbot`](/showcases/ai/chatbot)

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Grounded retrieval with a corpus map](/docs/pattern-library/layered-rag) (optional)


---

_Machine-readable record: `graph-rag` in `pattern-library/registry.json`._
