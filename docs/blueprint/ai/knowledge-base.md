# Knowledge Base & Retrieval

How v10r organizes the knowledge its chatbot answers from, and how it retrieves it. The integrating blueprint above [layered-rag.md](./layered-rag.md), [graph-rag.md](./graph-rag.md), and [surfaces.md](./surfaces.md) — read those for the per-layer detail; read this for the **whole-system mental model** and the honest map of what is wired versus scaffold.

> **This is a reference project. Wired-vs-scaffold honesty is the point.** Several pieces below are designed and schema-backed but not running in production (the llmwiki pointer layer never had a writer and was retired 2026-09-12; tier-3 graph is dormant for docs). Marking that truthfully is the showcase — a RAG pattern library that lies about what it ships teaches nothing. The [Phased roadmap](#phased-roadmap) at the end is **designed, not built**, past Phase C.

---

## Terminology

One name per concept, and the name is the path.

| Name | What it is | Where |
|------|------------|-------|
| **retrieval** | The **engine**: chunk → embed → tiers 1/2/3 → RRF fusion. The ground truth. | `src/lib/server/retrieval/` · `retrieval` pgSchema · `/api/retrieval/*` |
| **corpus map** | The **ingest-built map** of one collection's corpus — what it covers, without loading it. Deterministic, no LLM, no embedding; injected as `<project-overview>` on every chatbot turn. | `retrieval.corpus_map` · `db/schema/retrieval/corpus-map.ts` · `ai/capabilities/project-map.ts` |
| **llmwiki** | **RETIRED 2026-09-12** (Phase 4 of `docs/ai-ref-plan.md`, decision D2). Was the pointer layer over the engine: curated pages (`title + tldr + body + tags`) whose `pointers:` were source chunk ids. No writer ever ran in production; its one live piece — the deterministic overview row — is the corpus map above. | was `src/lib/server/llmwiki/` |

The umbrella term "nRAG" is gone. The docs claimed it was not a code identifier while
fourteen identifiers and one admin nav label used it; the subsystem is now named once, and
the name is the path.

The retired design's mental model, kept on record:

> **llmwiki = a connector/pointer layer over raw retrieval.** One curated TLDR per topic,
> each carrying chunk-id pointers down into the immutable chunk layer. It is a recognized
> pattern (multi-vector / doc-summary / parent-doc retrieval), not an invention.

The model was to answer from llmwiki TLDRs by default and drill into source chunks only for exact wording or claim verification. The layer never got its writer, so the chatbot answers from the corpus map plus flat retrieval and the catalog. See [layered-rag.md](./layered-rag.md#read-path-chat-hot-path).

---

## Wired vs scaffold (the honest map)

What actually runs today, what is schema-backed scaffolding, and what is designed only.

| Piece | Status | Reality |
|-------|--------|---------|
| retrieval tier-1 (contextual hybrid vector + BM25) | **BUILT** | The live grounding path — and **the only tier the chatbot reaches** (it requests `tiers:[1]`). |
| retrieval tier-2 (parent-child) | **BUILT (engine) / not reached by chatbot** | Engine works. The unified ingest door (Phase C step 1) now writes hierarchical parents+children, so tier-2 is *eligible* for converted docs — but the chatbot requests `tiers:[1]` only, so tier-2 stays unexercised until a tier-2 surface (reranker) lands. |
| Unified ingest door (hierarchical docs chunks) | **BUILT 2026-06-25 / partial corpus** | `ingest-docs.ts` reuses the app's pure `planChunks()` → section-parents + paragraph-children. **Groundwork: does not change chatbot answers today** (the chatbot is tier-1-only; flat and hierarchical paragraph-children read identically through tier-1). Conversion partial — 36 of 93 docs as of 2026-06-25 (quota-gated, multi-day; see corpus model below). |
| retrieval tier-3 (Neo4j graph) | **BUILT (engine) / DORMANT for docs** | Engine works; the docs corpus seeds no entities, so tier-3 returns `[]`. The catalog `:Resource` graph exists but is never queried by retrieval. |
| RRF fusion (k=60) | **BUILT** | Live, but cross-tier RRF rarely fires for docs because tiers 2/3 are empty. |
| **llmwiki pointer layer** | **RETIRED 2026-09-12** | Engine worked, but no pages ever existed for a normal user — `compile/` and `lint/` were never built; a hand-seed script was the only writer. Deleted outright (domain, capability, drill tools, tables); its one live piece became the ingest-built corpus map (below). Decision D2, `docs/ai-ref-plan.md`. |
| Relevance-gated system-docs prefetch | **BUILT** | The chatbot's actual safety net today — a parallel tier-1 `retrieve()` over the system-docs corpus. See [layered-rag.md](./layered-rag.md#read-path-chat-hot-path). |
| Citation verification | **BUILT (catalog path check)** | The `catalog` capability's `verify` matches every project path the answer names against the rows the turn surfaced → `path` / `unsurfaced`. The wiki's quote/paraphrase hash check went with the layer. |
| Catalog grounding (`search_catalog`, `<catalog-map>`) | **BUILT** | Live. Postgres-only — does not touch the Neo4j catalog graph. |
| Corpus map (`<project-overview>`) | **BUILT · browser-verified 2026-06-25** (as the "system overview anchor"; renamed `retrieval.corpus_map` 2026-09-12) | `getCorpusMap(ownerIds, collectionId)` is owner-aware (`inArray(userId, ownerIds)`); the `project-map` capability injects a `<project-overview>` block from `loadProjectMap()` → `getCorpusMap([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID)`, written by `ingest-docs.ts` (`writeProjectMap`). **The load-bearing fix for "how do I use v10r?"** — a plain DB-row read, embed-independent, so it lands even when the embed quota is exhausted. A deterministic in-intro **Stack:** line rescues the stack answer from read-truncation — built + validated 2026-06-25; see corpus model below. |
| Embed retry / loud failure tracing | **BUILT 2026-06-25** | `embed.ts` retries Gemini 429/quota with asymmetric backoff; the orchestrator now emits `{step:'embed', status:'error'}` when system-docs retrieval rejects — the silent ungrounding (`Promise.allSettled` masking) is gone. |
| rag-demo showcase surface | **RETIRED (2026-08)** | Was thin/dishonest (`tiers:[1], maxChunks:3` only — RRF-across-tiers never fired). Deleted with the retrieval showcase tree; the `/showcases/ai/chatbot` architecture page now teaches the per-surface retrieval profile via recorded fixtures, honestly marking tiers 2–3 dormant. |
| Step-back transform · reranker · eval harness · graph `:DEPENDS_ON` | **DESIGNED, NOT BUILT** | See [Phased roadmap](#phased-roadmap). |
| Telemetry: `vectorHits` / `bm25Hits` split | **REMOVED 2026-09-12** | Was fabricated — the llmwiki branch emitted the same number three times. Gone with the branch and the `pipeline:*` events; the turn trace is the only trace author ([turn-trace.md](./turn-trace.md)). |

The asymmetry is deliberate: the **engine** is mature; the **food** (the corpus) is thin. That is the inverse of where the leverage is — see [The recall safety net](#the-recall-safety-net).

---

## The corpus & chunking model (the "food")

Retrieval quality is bounded by chunk quality. Markdown becomes a two-level hierarchy:

- **Parents** (`level = 'section'`) — heading-bounded sections. Stored with `embedding = NULL` so tier-1 never surfaces them; they exist only as tier-2 parent context.
- **Children** (`level = 'paragraph'`) — embedded leaves, each linked to its parent via `parent_id`.

Every child carries a **deterministic heading-breadcrumb context prefix** — `${doc.title} › ${deepest heading}` — prepended before embedding so a chunk pulled in isolation still knows where it sits. This is a cheap stand-in for Anthropic-style LLM contextual prep, which is **deferred**: per-chunk LLM calls are infeasible on a ~20-req/day free-tier ceiling. The breadcrumb is derived by scanning ATX heading lines, no model call.

**Two corpora, one kernel:**

| Corpus | Owner | Fed by | Status |
|--------|-------|--------|--------|
| `SYSTEM_DOCS` (the chatbot's real KB) | `SYSTEM_DOCS_USER_ID` | `scripts/db/ingest-docs.ts` | Live — hierarchical conversion in progress (36/93 as of 2026-06-25) |
| Per-user desk files | the real user | `syncDeskFileToRetrieval` (shared kernel) | Live, hierarchical |

**The unified ingest door (the two-chunker divergence, resolved 2026-06-25).** The docs corpus was historically fed by a Bun script that re-implemented chunking via the dependency-free `markdown-split.ts` — flat paragraph chunks, bare-title prefix, no parents. As of 2026-06-25, `ingest-docs.ts` reuses the app's pure `planChunks()` (`retrieval/plan.ts`), so both runtimes share one door: it writes section-parents (`embedding = NULL`) + paragraph-children (`parent_id` set, deterministic `"<docTitle> › <deepestHeading>"` breadcrumb prefix). Entities + Neo4j remain app-path-only.

**Conversion is partial and quota-gated — not a defect.** Live state 2026-06-25: **36 of 93 docs hierarchical, 57 still flat.** The Gemini free tier caps embeddings at **1000 `embed_content` requests/day**; the corpus is ~1586 chunks, so a full flat→hierarchical re-ingest spans multiple days. The re-ingest is resume-safe — `INGEST_FORCE=1` / `--force` skips any doc that already has a `level='section'` chunk. **This partial state does not degrade chatbot answers:** the chatbot reaches **tier-1 only**, and tier-1 reads flat and hierarchical paragraph-children identically. Proven 2026-06-25 — a question answered from a still-flat doc (`multi-client-core`, 0 sections / 33 embedded paragraphs) returned a correct, cited answer. Hierarchical chunking is groundwork for future tier-2 surfaces (reranker), **not** the change that corrected the chatbot.

**The corpus map (BUILT as the "system overview anchor", browser-verified 2026-06-25; renamed `retrieval.corpus_map` 2026-09-12).** A single high-level row (system-owned, deterministic 94-doc knowledge-map TOC) injected into every chatbot turn as a `<project-overview>` block. `ingest-docs.ts` writes it (`writeProjectMap`, no LLM, no embedding); `getCorpusMap(ownerIds, collectionId)` is owner-aware (`inArray(userId, ownerIds)`); the `project-map` capability loads `getCorpusMap([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID)`. Verified live 2026-06-25: exactly one overview row (`system-docs`/`project-docs`, `source_count = 94`); grounding fired end-to-end. (`source_count = 94` was the full manifest doc count; the 36/57/93 corpus figures above count docs with live chunks — one doc transiently sits in a soft-deleted gap when the daily embed cap is hit, self-healing on the next resume run.) **This is the load-bearing fix for the original broad-question bug** — and because it is a plain DB-row read with no embedding, it lands even when the embed quota is exhausted. Read-truncation hazard, fixed 2026-06-25: the stored body is 5000 chars but the read cuts at 2000 chars (today `PROJECT_MAP_MAX_CHARS`, `ai/config.ts`; then `OVERVIEW_MAX_TOKENS × CHARS_PER_TOKEN` = 500 × 4). The TOC is section-ordered `foundation › blueprint › stack`, so the large blueprint section pushed the `## stack` list past 2000 chars — "which stack does v10r use?" was truncated off before the model saw it (compounded by design: every clean stack *enumeration* — `docs/stack/README.md`, `docs/stack/vendors.md`, `CLAUDE.md` — is corpus-excluded, so retrieval alone can't surface it). Fix: `buildOverviewBody()`, extracted to the Vite-free, unit-testable `src/lib/server/docs/overview-body.ts` (imported back by `ingest-docs.ts`, same pattern as `doc-filter.ts`), inserts a deterministic one-line **Stack:** summary right after the intro and before the TOC (~char 320, well inside the ceiling), names derived from the core stack subsection doc titles — no hardcoding. The read ceiling is deliberately unchanged. The rest of the TOC still truncates; only the stack answer is rescued. Built + validated 2026-06-25.

**Why README nav-hubs are excluded.** Every docs directory has a `README.md` that is a navigation index — topic tables mapping files to topics ([docs/README.md](../../README.md)). Those are pointers, not prose; embedding them pollutes retrieval with link-lists that answer nothing. `isBlocked` drops every `*/README.md` from the corpus.

---

## The recall safety net

**The pointer (llmwiki) layer must always run IN PARALLEL with flat retrieval. A summary can never gate recall.**

This is the load-bearing principle of the whole design. The research consensus is blunt about the failure mode: a summary/pointer layer is the **lowest-leverage** lever and the **highest-risk** one, because "the summary hid the chunk" silently drops recall — the answer was in the corpus, but the curated page didn't point at it.

| Source | Finding |
|--------|---------|
| ARAGOG (retrieval ablation survey) | Summary-first retrieval underperforms hybrid flat retrieval on recall. |
| Anthropic Contextual Retrieval | Contextual chunk prefixes cut retrieval failures by **−67%** — fix the chunk, not the summary. |

So flat `retrieve()` ran unconditionally underneath the pointer layer; results were deduped by `chunkId` and reranked (no second RRF pass). The flat net is the recall guarantee. **llmwiki was never to be promoted to the default answer surface until a lint job was scheduled and green** — the lint job was never built, and the layer was retired 2026-09-12. This is why the system-docs prefetch (live) always mattered more than the llmwiki layer, and why the ingest-built corpus map — a deterministic TOC, not a summary — is the anchor that replaced it.

---

## Retrieval-strategy seams

The target query path, with each seam's build status. "A blank stage is a lie; a skipped stage is the lesson" — the showcase must emit every stage, marking unrun ones `status:'skipped'` rather than hiding them.

```
query
  → step-back query-transform   (PLANNED · gated on broad-query intent, quota-budgeted, identity-fallback)
  → per-tier retrieval          (BUILT · tier-1 live & chatbot-only; tiers 2/3 eligible for converted docs, unexercised by chatbot)
  → RRF fusion (k=60)           (BUILT · rarely fires multi-tier for docs today)
  → rerank                      (PLANNED · slots after fusion, deterministic/local fallback)
  → citation-verify             (BUILT · catalog path check after the stream: path / unsurfaced)
  → eval                        (PLANNED · golden-set harness, RAGAS-style metrics)
```

Sequencing matters: **step-back runs BEFORE embed** (it rewrites the query); **rerank runs AFTER fusion** (it reorders candidates). Both are gated and fall back to identity so a quota-exhausted turn still answers. The orchestrator must be split along these seams before eval and rerank have a slot to live in — extracting the retrieval-strategy seam is the unblocking move. See [Phased roadmap](#phased-roadmap).

---

## Data-model & contract notes

Summaries only — the detail lives in code and in the roadmap.

| Area | Decision |
|------|----------|
| **Embedding dimension** | `1536` is DDL-bound (`vector(N)` literal) → stays a **TS constant** (SSOT in `retrieval-shared/embed-config.ts`, re-exported by `config.ts`). The `retrieval.embedding_model` row becomes the live **model-identity** registry (provider/task/active) with a `CHECK` guarding agreement. Dimension and identity are split: one is structural, one is data. |
| **Owner-aware corpus map** | `getCorpusMap(ownerIds: string[], collectionId)` via `inArray` (the precedent `graph/rag/queries.ts` already uses) so a read can span the system owner and the viewer. One row per collection (`collection_id` unique). |
| **Eval store** | New `eval` pgSchema cluster: `golden_item`, `golden_expected_source`, `eval_run`, `eval_result` — one numeric column per RAGAS-style metric. |
| **Graph `:DEPENDS_ON`** | The catalog graph has only `PART_OF` (containment) → can't answer "what depends on Drizzle?". Earns its keep only with a `:DEPENDS_ON` edge + an `:Entity-[:ABOUT]->:Resource` bridge. `:Entity` and `:Resource` stay separate. |
| **Per-surface request schemas** | **DONE (2026-08).** `ChatbotRequestSchema` / `DeskRequestSchema` are split per surface; the retrieval knobs (`useRetrieval`/`retrievalTiers`/`fusion`/`useLlmwiki`/`dryRun`) were deleted with the rag-demo surface, so no showcase knob can leak into the product chatbot. |
| **`/admin/ai/rag/health`** | New endpoint = the wired-vs-scaffold board (above) made live + per-tier contribution telemetry. Surfaces the `*_SCAFFOLD` sentinels the UI and these docs both cite. |
| **Per-locale tsvector** | The BM25 `tsvector` is English-only across a tri-locale (en/de/ru) app → a `CASE`-on-`locale` generated column keyed off `document.locale` / `chunk.locale`. |

---

## Tooling rationale

| Choice | Verdict |
|--------|---------|
| **Hand-rolled (no LangChain / LlamaIndex)** | **Right call.** The TS RAG framework ecosystem is 18–24 months behind Python and a framework graveyard at this scale. Hand-rolled keeps every seam inspectable — which is the whole point of a showcase. |
| **pgvector / Neon** | Fine at this scale (nowhere near the 5–10M-vector range where dedicated stores matter). Caveat: disable Neon auto-suspend or the HNSW index pays a cold-start penalty on the first query. |
| **Neo4j (graph tier)** | ~Zero value for single-hop docs Q&A (GraphRAG-Bench: vanilla **60.92** vs MS-graph **49.29**). Earns its keep **only** for multi-hop dependency queries ("what depends on Drizzle?") — hence `:DEPENDS_ON` is the one graph investment worth making. |

The research line throughout: **fix the food, not the framework.** Self-contained chunks, contextual prefixes, a corpus map, README exclusion, hybrid BM25, step-back, a reranker, and a golden-set eval all outrank any amount of orchestration cleverness. A summary/pointer layer is the last thing to invest in, and only behind a lint net — which is why it was retired rather than finished.

---

## Phased roadmap

> **Everything past Phase C is DESIGNED, not built.** Phase C **landed and was browser-verified on 2026-06-25**; it is migration-free (no `db:push` — every column already exists) and its only deploy action is re-running `db:ingest-docs`. The rest is captured here so the decisions don't evaporate.

### Phase C — Foundation (BUILT + browser-verified 2026-06-25, migration-free)

The three quick-wins, independently the right foundation. Steps 2 + 3 share one orchestrator edit hotspot (the `Promise.allSettled` grounding block) and landed in one pass. All three are live — 5/5 functional probes green on 2026-06-25, with honest "I don't have that in the provided documentation" on out-of-corpus questions (no fabricated paths or numbers).

| # | Step | Effect | Status |
|---|------|--------|--------|
| 1 | **Unify the ingest door** — `ingest-docs.ts` reuses pure Vite-free `planChunks` + `retrieval-shared/embed-config.ts`. | Writes hierarchical section-parents + paragraph-children. **Groundwork only** — makes tier-2 *eligible*; does not change chatbot answers (chatbot is tier-1-only). Zero query-path change. | BUILT · corpus 36/93 (partial, quota-gated, resume-safe) |
| 2 | **Embed-retry + loud tracing** — bounded retry/backoff in `embed.ts`; add the missing rejected branch in the orchestrator. | Kills silent ungrounding; a 429 becomes an observable `{step:'embed', status:'error'}`. | BUILT |
| 3 | **Owner-aware overview + write the system anchor** — owner-aware read; write the deterministic system-overview row; inject the `<project-overview>` block. (Since 2026-09-12: `getCorpusMap` over `retrieval.corpus_map`.) | **The load-bearing fix** for "how do I use v10r?". Embed-independent — lands even when embed quota is exhausted. | BUILT · verified |

### Beyond Phase C (designed, not built)

| Order | Item | Status |
|-------|------|--------|
| 4 | **Retrieval-strategy orchestrator split** — extract `retrieval/strategy/chatbot-context.ts` FIRST; it unblocks the eval harness and the reranker slot. | DESIGNED |
| 5 | **Step-back query-transform + reranker** — both gated on broad-query intent + quota, both with deterministic/identity fallback. | DESIGNED |
| 6 | **llmwiki compile + recompile job** — auto-generate page TLDR/body/pointers from source chunks. | DROPPED 2026-09-12 with the layer |
| 7 | **lint nightly** — the gate before llmwiki could lead. | DROPPED 2026-09-12 with the layer |
| 8 | **eval schema + golden-set harness** — `eval` pgSchema cluster; 202+poll admin endpoints (reuse the `/admin/db` run pattern, Idempotency-Key). | DESIGNED |
| 9 | **Graph `:DEPENDS_ON` + docs entity tier** — earns tier-3 its keep for multi-hop dependency queries; heavier (needs a Neo4j driver in the script). | DESIGNED |
| 10 | **Per-locale tsvector** — `CASE`-on-`locale` generated column. | DESIGNED |
| 11 | **Fabricated-telemetry fix** — stop emitting the phantom `vectorHits`/`bm25Hits` split; emit real per-tier contribution. | DESIGNED |

### Open product decisions

| Decision | Recommendation | Why |
|----------|----------------|-----|
| **Recompile trigger** (eager / nightly-batched / lazy-on-read) | **Nightly-batched** — moot since 2026-09-12 (layer retired) | All three amplify LLM calls against a 20-req/day ceiling; batching is the only one that survives the quota. |
| **Per-surface request schema split** | **Proceed** | Low-risk — clients send a superset and ignore extras; the win (knobs can't leak to the product chatbot) is worth it. |
| **Admin endpoint versioning** | **Unversioned** | Matches existing admin precedent (`/admin/db`, `/admin/ai/*`). |

---

## Related

- [layered-rag.md](./layered-rag.md) — one kernel, two profiles, the corpus map, read path, tool contracts, catalog grounding, graph tenancy. **The primary RAG doc.**
- [surfaces.md](./surfaces.md) — chatbot vs deskbot; the one-kernel/two-profiles model.
- [graph-rag.md](./graph-rag.md) — retrieval internals; the catalog `:Resource` seed; the hybrid pipeline.
- [README.md](./README.md) — AI blueprint nav hub.
