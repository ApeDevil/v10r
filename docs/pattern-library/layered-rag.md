---
title: "Grounded retrieval with a corpus map"
description: "One shared retrieve() kernel (embed → tiers → RRF fusion) under a single user_id tenant filter, composed per turn by the chatbot profile: a deterministic…"
category: "AI"
---

# Grounded retrieval with a corpus map

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** proven (verified 2026-09-12 @ 6307c4b6) · **Risk:** medium — external embedding/LLM providers with quota limits

One shared retrieve() kernel (embed → tiers → RRF fusion) under a single user_id tenant filter, composed per turn by the chatbot profile: a deterministic corpus map anchors every turn, a relevance-gated docs lane and the catalog lane ground the prompt, and a post-stream verifier ties each path the answer names to what the turn surfaced.

**When to use:** Use when a project needs grounded answers over a corpus: start with read-only search plus citation/provenance before adding any mutating tools.

## Docs

- [docs/blueprint/ai/layered-rag.md](/docs/blueprint/ai/layered-rag) — Kernel, profiles, corpus map, catalog grounding, docs corpus ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/layered-rag.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/layered-rag.md))
- [docs/blueprint/ai/knowledge-base.md](/docs/blueprint/ai/knowledge-base) — Corpus and ingest door ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/knowledge-base.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/knowledge-base.md))
- [docs/blueprint/ai/graph-rag.md](/docs/blueprint/ai/graph-rag) — Graph tier ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/graph-rag.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/graph-rag.md))

## Code

- `src/lib/server/retrieval/index.ts` — retrieve() — the single shared kernel ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/index.ts))
- `src/lib/server/retrieval/plan.ts` — Retrieval planning ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/plan.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/plan.ts))
- `src/lib/server/retrieval/tiers/` — Tier implementations ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/retrieval/tiers) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/retrieval/tiers))
- `src/lib/server/ai/capabilities/project-map.ts` — The corpus map as the prompt anchor ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/capabilities/project-map.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/capabilities/project-map.ts))
- `src/lib/server/ai/capabilities/project-docs.ts` — Relevance-gated docs lane + search_project_docs ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/capabilities/project-docs.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/capabilities/project-docs.ts))
- `src/lib/server/db/schema/retrieval/corpus-map.ts` — retrieval.corpus_map — built at ingest, never by a model ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/schema/retrieval/corpus-map.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/schema/retrieval/corpus-map.ts))

## Tests

- `src/lib/server/retrieval/index.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/index.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/index.test.ts))
- `src/lib/server/retrieval/plan.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/plan.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/plan.test.ts))
- `src/lib/server/retrieval/rank.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/rank.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/rank.test.ts))
- `src/lib/server/ai/capabilities/project-map.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/capabilities/project-map.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/capabilities/project-map.test.ts))
- `src/lib/server/ai/profile/chatbot.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/profile/chatbot.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/profile/chatbot.test.ts))

## Proof

- [`/showcases/ai/chatbot`](/showcases/ai/chatbot)

## Invariants

- The kernel is never forked — a single user_id tenant filter at the chunk level is the corpus boundary; a duplicated filter would be a cross-tenant leak.
- Retrieval tools close over the turn's userId when their capability mounts them — the model cannot forge identity.
- The corpus map is built from the documents at ingest, never compiled by a model: the prompt anchor cannot drift from the corpus it describes.
- Inclusion never claims influence — a chunk in the prompt is `included`; only a path the answer names against a surfaced row is `cited`.

## Emulation notes

- 'nRAG' in docs is a concept name only — the code identifier is retrieval/retrieve(); do not search for an retrieval module.
- Build the chunk layer and the ingest-built map first; an LLM-compiled summary layer was tried here and retired — it had no writer and every fresh user started empty.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `layered-rag` in `pattern-library/registry.json`._
