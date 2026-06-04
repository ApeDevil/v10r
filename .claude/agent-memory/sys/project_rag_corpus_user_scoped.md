---
name: rag-corpus-user-scoped
description: The whole RAG corpus (rawrag + llmwiki) is hard-filtered by user_id; there is no shared/global corpus path despite the schema allowing null-owned docs
metadata:
  type: project
---

The entire retrieval corpus is **per-user scoped at the query layer**, which blocks any "shared knowledge base" feature (e.g. grounding the chatbot in the project's own `docs/`).

- rawrag tiers all filter `d.user_id = ${userId}` (contextual.ts:45,75 / parent-child.ts:41 / graph.ts:29 / queries.ts:39).
- llmwiki search + overview filter `p.user_id = ${userId}` (search.ts:72,111 / overview via queries.ts).
- BUT `rag.document.userId` is nullable and `ingest()` already accepts `doc.userId ?? null` (rawrag/ingest/index.ts:63). So a null-owned ("global") doc is *representable* but *unreachable* — no query has an `OR d.user_id IS NULL` branch.
- The llmwiki **compile pipeline is a scaffold** (`COMPILE_SCAFFOLD = true`, llmwiki/compile/index.ts) — there is no raw-chunk → wiki-page builder. The only llmwiki data is the 3-chunk dogfood fixture from `scripts/seed-llmwiki.ts`.

**Why:** Discovered tracing the sidebar-chatbot grounding task (2026-06-04). Capability (A) catalog links is a client flag-flip; capability (B) docs-grounding is NOT — it needs (1) a docs ingestion pipeline and (2) a corpus-scope decision: own all docs under a system user, or add `OR user_id IS NULL` to every retrieval query.

**How to apply:** Any "ground the bot in project docs / shared corpus" request must first resolve the ownership model. Do not assume `useLlmwiki=true` will surface docs — the corpus is empty of docs and user-fenced. Flag-flipping only re-runs retrieval over the asking user's *own* uploaded docs.
