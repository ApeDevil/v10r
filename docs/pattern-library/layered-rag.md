---
title: "Layered RAG (llmwiki pointer layer over a rawrag kernel)"
description: "A shared rawrag retrieve() kernel (embed → tiers → RRF fusion → drill) feeds two layers: llmwiki TLDR pointer pages as the answer surface over immutable…"
category: "AI"
---

# Layered RAG (llmwiki pointer layer over a rawrag kernel)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external embedding/LLM providers with quota limits

A shared rawrag retrieve() kernel (embed → tiers → RRF fusion → drill) feeds two layers: llmwiki TLDR pointer pages as the answer surface over immutable rawrag chunks as the audit trail.

**When to use:** Use when a project needs grounded answers over a corpus: start with read-only search plus citation/provenance before adding any mutating tools.

## Docs

- [docs/blueprint/ai/layered-rag.md](/docs/blueprint/ai/layered-rag) — The two-layer architecture ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/layered-rag.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/layered-rag.md))
- [docs/blueprint/ai/knowledge-base.md](/docs/blueprint/ai/knowledge-base) — Corpus and ingest door ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/knowledge-base.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/knowledge-base.md))
- [docs/blueprint/ai/graph-rag.md](/docs/blueprint/ai/graph-rag) — Graph tier ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/graph-rag.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/graph-rag.md))

## Code

- `src/lib/server/rawrag/index.ts` — retrieve() — the single shared kernel ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/index.ts))
- `src/lib/server/rawrag/plan.ts` — Retrieval planning ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/plan.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/plan.ts))
- `src/lib/server/rawrag/tiers/` — Tier implementations ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/rawrag/tiers) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/rawrag/tiers))
- `src/lib/server/llmwiki/search.ts` — Pointer-layer search ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/llmwiki/search.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/llmwiki/search.ts))
- `src/lib/server/llmwiki/overview.ts` — Deterministic system-overview anchor ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/llmwiki/overview.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/llmwiki/overview.ts))

## Tests

- `src/lib/server/rawrag/index.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/index.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/index.test.ts))
- `src/lib/server/rawrag/plan.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/plan.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/plan.test.ts))
- `src/lib/server/rawrag/rank.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/rank.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/rank.test.ts))
- `src/lib/server/llmwiki/rrf.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/llmwiki/rrf.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/llmwiki/rrf.test.ts))
- `src/lib/server/llmwiki/overview.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/llmwiki/overview.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/llmwiki/overview.test.ts))

## Proof

- [`/showcases/ai/chatbot`](/showcases/ai/chatbot)

## Invariants

- The kernel is never forked — a single user_id tenant filter at the chunk level is the corpus boundary; a duplicated filter would be a cross-tenant leak.
- Retrieval tools close over userId via buildRetrievalTools({ userId }) — the model cannot forge identity.
- Raw chunks are source truth; llmwiki is the compressed pointer layer — the model answers from wiki TLDRs by default and drills into raw chunks only when the user asks for exact wording or challenges a claim.

## Emulation notes

- 'nRAG' in docs is a concept name only — the code identifier is rawrag/retrieve(); do not search for an nrag module.
- Build the raw layer first; the pointer layer compiles from it and can start empty.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `layered-rag` in `mcp/patterns.registry.json`._
