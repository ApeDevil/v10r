# Knowledge Base & Retrieval

How v10r organizes the knowledge its chatbot answers from, and how it retrieves it. The integrating blueprint above [layered-rag.md](./layered-rag.md), [graph-rag.md](./graph-rag.md), and [surfaces.md](./surfaces.md) — read those for the per-layer detail; read this for the **whole-system mental model** and the honest map of what is wired versus scaffold.

> **This is a reference project. Wired-vs-scaffold honesty is the point.** Several pieces below are designed and schema-backed but not running in production (the llmwiki pointer layer is empty; tier-3 graph is dormant for docs; some telemetry is fabricated). Marking that truthfully is the showcase — a RAG pattern library that lies about what it ships teaches nothing. The [Phased roadmap](#phased-roadmap) at the end is **designed, not built**, past Phase C.

---

## Terminology

Three names, one of which is not code.

| Name | What it is | Where |
|------|------------|-------|
| **rawrag** | The retrieval **engine**: chunk → embed → tiers 1/2/3 → RRF fusion → drill-by-id. The ground truth. | `src/lib/server/rawrag/` |
| **llmwiki** | The **pointer/connector layer over rawrag**: curated pages (`title + tldr + body + tags`) whose `pointers:` are raw chunk ids. A summary surface, not a separate corpus. | `src/lib/server/llmwiki/` |
| **"nRAG"** | Umbrella term in docs/memory only — **not a code identifier.** Means "the whole retrieval subsystem." | — |

The user's mental model is exact and worth stating plainly:

> **nRAG = a connector/pointer over raw-RAG.** That *is* the llmwiki design — one curated TLDR per topic, each carrying chunk-id pointers down into the immutable rawrag layer. It is a recognized pattern (multi-vector / doc-summary / parent-doc retrieval), not an invention.

The model answers from llmwiki TLDRs by default and drills into rawrag chunks only for exact wording or claim verification. llmwiki is the answer surface; rawrag is the audit trail. See [layered-rag.md](./layered-rag.md#layer-split).

---

## Wired vs scaffold (the honest map)

What actually runs today, what is schema-backed scaffolding, and what is designed only.

| Piece | Status | Reality |
|-------|--------|---------|
| rawrag tier-1 (contextual hybrid vector + BM25) | **BUILT** | The live grounding path — and **the only tier the floating chatbot reaches** (it requests `tiers:[1]`). |
| rawrag tier-2 (parent-child) | **BUILT (engine) / not reached by chatbot** | Engine works. The unified ingest door (Phase C step 1) now writes hierarchical parents+children, so tier-2 is *eligible* for converted docs — but the chatbot requests `tiers:[1]` only, so tier-2 stays unexercised until a tier-2 surface (rag-demo / reranker) lands. |
| Unified ingest door (hierarchical docs chunks) | **BUILT 2026-06-25 / partial corpus** | `ingest-docs.ts` reuses the app's pure `planChunks()` → section-parents + paragraph-children. **Groundwork: does not change chatbot answers today** (the chatbot is tier-1-only; flat and hierarchical paragraph-children read identically through tier-1). Conversion partial — 36 of 93 docs as of 2026-06-25 (quota-gated, multi-day; see corpus model below). |
| rawrag tier-3 (Neo4j graph) | **BUILT (engine) / DORMANT for docs** | Engine works; the docs corpus seeds no entities, so tier-3 returns `[]`. The catalog `:Resource` graph exists but is never queried by retrieval. |
| RRF fusion (k=60) + drill-by-id | **BUILT** | Live, but cross-tier RRF rarely fires for docs because tiers 2/3 are empty. |
| **llmwiki search / pointer hydration** | **BUILT (engine) / EMPTY in prod** | `searchLlmwiki` works, but no pages exist — `compile/` + `lint/` are scaffolds (`COMPILE_SCAFFOLD`/`LINT_SCAFFOLD`). Only a per-user hand-seed script creates pages. **So the elegant pointer layer never runs for normal users.** |
| Relevance-gated system-docs prefetch | **BUILT** | The chatbot's actual safety net today — a parallel tier-1 `retrieve()` over the system-docs corpus. See [layered-rag.md](./layered-rag.md#read-path-chat-hot-path). |
| Citation verification (`verify.ts`) | **BUILT** | Runs on `onFinish`; assigns quote/paraphrase/drifted per chunk. |
| Catalog grounding (`search_catalog`, `<catalog-map>`) | **BUILT** | Live. Postgres-only — does not touch the Neo4j catalog graph. |
| System overview anchor | **BUILT · browser-verified 2026-06-25** | `getOverview`/`loadOverview` are owner-aware (`inArray(userId, ownerIds)`); the orchestrator injects a `<project-overview>` block from `loadOverview([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID)`, written by `ingest-docs.ts`. **The load-bearing fix for "how do I use v10r?"** — a plain DB-row read, embed-independent, so it lands even when the embed quota is exhausted. A deterministic in-intro **Stack:** line now rescues the stack answer from read-truncation — built + validated 2026-06-25, reaching the live anchor on the next post-quota-reset re-ingest; see corpus model below. |
| Embed retry / loud failure tracing | **BUILT 2026-06-25** | `embed.ts` retries Gemini 429/quota with asymmetric backoff; the orchestrator now emits `{step:'embed', status:'error'}` when system-docs retrieval rejects — the silent ungrounding (`Promise.allSettled` masking) is gone. |
| rag-demo showcase surface | **BUILT (thin) / DISHONEST** | Requests `tiers:[1], maxChunks:3` only — RRF-across-tiers never fires; no rerank/transform/eval/drill. The teaching surface can't teach the pipeline. |
| Step-back transform · reranker · eval harness · graph `:DEPENDS_ON` | **DESIGNED, NOT BUILT** | See [Phased roadmap](#phased-roadmap). |
| Telemetry: `vectorHits` / `bm25Hits` split | **FABRICATED** | The llmwiki branch emits the same number three times. `LlmwikiSearchDetail` promises a split that doesn't exist. |

The asymmetry is deliberate: the **engine** is mature; the **food** (corpus + curated pointer pages) is thin. That is the inverse of where the leverage is — see [The recall safety net](#the-recall-safety-net).

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
| Per-user desk files | the real user | `syncDeskFileToRag` (shared kernel) | Live, hierarchical |

**The unified ingest door (the two-chunker divergence, resolved 2026-06-25).** The docs corpus was historically fed by a Bun script that re-implemented chunking via the dependency-free `markdown-split.ts` — flat paragraph chunks, bare-title prefix, no parents. As of 2026-06-25, `ingest-docs.ts` reuses the app's pure `planChunks()` (`rawrag/plan.ts`), so both runtimes share one door: it writes section-parents (`embedding = NULL`) + paragraph-children (`parent_id` set, deterministic `"<docTitle> › <deepestHeading>"` breadcrumb prefix). Entities + Neo4j remain app-path-only.

**Conversion is partial and quota-gated — not a defect.** Live state 2026-06-25: **36 of 93 docs hierarchical, 57 still flat.** The Gemini free tier caps embeddings at **1000 `embed_content` requests/day**; the corpus is ~1586 chunks, so a full flat→hierarchical re-ingest spans multiple days. The re-ingest is resume-safe — `INGEST_FORCE=1` / `--force` skips any doc that already has a `level='section'` chunk. **This partial state does not degrade chatbot answers:** the floating chatbot reaches **tier-1 only**, and tier-1 reads flat and hierarchical paragraph-children identically. Proven 2026-06-25 — a question answered from a still-flat doc (`multi-client-core`, 0 sections / 33 embedded paragraphs) returned a correct, cited answer. Hierarchical chunking is groundwork for future tier-2 surfaces (rag-demo / reranker), **not** the change that corrected the chatbot.

**The system overview anchor (BUILT, browser-verified 2026-06-25).** A single high-level `kind='overview'` llmwiki row (system-owned, deterministic 94-doc knowledge-map TOC) injected into every chatbot turn as a `<project-overview>` block. `ingest-docs.ts` writes it; `getOverview`/`loadOverview` are owner-aware (`inArray(userId, ownerIds)`); the orchestrator loads `loadOverview([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID)`. Verified live: exactly one overview row (`system-docs`/`project-docs`, `source_count = 94`, embedded); grounding fires end-to-end (`llmwiki:overview → search → context → generate`). (`source_count = 94` is the full manifest doc count; the 36/57/93 corpus figures above count docs with live chunks — one doc transiently sits in a soft-deleted gap when the daily embed cap is hit, self-healing on the next resume run.) **This is the load-bearing fix for the original broad-question bug** — and because it is a plain DB-row read with no embedding, it lands even when the embed quota is exhausted. Read-truncation hazard, fixed 2026-06-25: the stored body is 5000 chars but `loadOverview` truncates at read to `OVERVIEW_MAX_TOKENS × CHARS_PER_TOKEN` = 500 × 4 = 2000 chars. The TOC is section-ordered `foundation › blueprint › stack`, so the large blueprint section pushed the `## stack` list past 2000 chars — "which stack does v10r use?" was truncated off before the model saw it (compounded by design: every clean stack *enumeration* — `docs/stack/README.md`, `docs/stack/vendors.md`, `CLAUDE.md` — is corpus-excluded, so retrieval alone can't surface it). Fix: `buildOverviewBody()`, extracted to the Vite-free, unit-testable `src/lib/server/docs/overview-body.ts` (imported back by `ingest-docs.ts`, same pattern as `doc-filter.ts`), now inserts a deterministic one-line **Stack:** summary right after the intro and before the TOC (~char 320, well inside the ceiling), names derived from the core stack subsection doc titles — no hardcoding. `OVERVIEW_MAX_TOKENS` is deliberately unchanged. The rest of the TOC still truncates; only the stack answer is rescued. **Built + validated 2026-06-25; reaches the live anchor on the next post-quota-reset `db:ingest-docs`** — the stored row is not yet rewritten (today's embed quota is exhausted).

**Why README nav-hubs are excluded.** Every docs directory has a `README.md` that is a navigation index — topic tables mapping files to topics ([docs/README.md](../../README.md)). Those are pointers, not prose; embedding them pollutes retrieval with link-lists that answer nothing. `isBlocked` drops every `*/README.md` from the corpus.

---

## The recall safety net

**The pointer (llmwiki) layer must always run IN PARALLEL with flat retrieval. A summary can never gate recall.**

This is the load-bearing principle of the whole design. The research consensus is blunt about the failure mode: a summary/pointer layer is the **lowest-leverage** lever and the **highest-risk** one, because "the summary hid the chunk" silently drops recall — the answer was in the corpus, but the curated page didn't point at it.

| Source | Finding |
|--------|---------|
| ARAGOG (retrieval ablation survey) | Summary-first retrieval underperforms hybrid flat retrieval on recall. |
| Anthropic Contextual Retrieval | Contextual chunk prefixes cut retrieval failures by **−67%** — fix the chunk, not the summary. |

So flat `retrieve()` runs unconditionally underneath the pointer layer; results are deduped by `chunkId` and reranked (no second RRF pass). The flat net is the recall guarantee. **llmwiki must not be promoted to the default answer surface until the lint job is scheduled and green** — until then, the parallel flat path is what keeps recall honest. This is why the system-docs prefetch (live) matters more than the empty llmwiki layer.

---

## Retrieval-strategy seams

The target query path, with each seam's build status. "A blank stage is a lie; a skipped stage is the lesson" — the showcase must emit every stage, marking unrun ones `status:'skipped'` rather than hiding them.

```
query
  → step-back query-transform   (PLANNED · gated on broad-query intent, quota-budgeted, identity-fallback)
  → per-tier retrieval          (BUILT · tier-1 live & chatbot-only; tiers 2/3 eligible for converted docs, unexercised by chatbot)
  → RRF fusion (k=60)           (BUILT · rarely fires multi-tier for docs today)
  → rerank                      (PLANNED · slots after fusion, deterministic/local fallback)
  → drill-by-id                 (BUILT · verbatim-ids rule, see layered-rag.md)
  → citation-verify             (BUILT · onFinish, quote/paraphrase/drifted)
  → eval                        (PLANNED · golden-set harness, RAGAS-style metrics)
```

Sequencing matters: **step-back runs BEFORE embed** (it rewrites the query); **rerank runs AFTER fusion** (it reorders candidates). Both are gated and fall back to identity so a quota-exhausted turn still answers. The orchestrator must be split along these seams before eval and rerank have a slot to live in — extracting the retrieval-strategy seam is the unblocking move. See [Phased roadmap](#phased-roadmap).

---

## Data-model & contract notes

Summaries only — the detail lives in code and in the roadmap.

| Area | Decision |
|------|----------|
| **Embedding dimension** | `1536` is DDL-bound (`vector(N)` literal) → stays a **TS constant** (SSOT in `rag-shared/embed-config.ts`, re-exported by `config.ts`). The `rag.embedding_model` row becomes the live **model-identity** registry (provider/task/active) with a `CHECK` guarding agreement. Dimension and identity are split: one is structural, one is data. |
| **Owner-aware overview** | `getOverview(ownerIds: string[])` via `inArray` (the precedent `graph/rag/queries.ts` already uses) so a logged-in user loads both their own overview and the system overview. |
| **Eval store** | New `eval` pgSchema cluster: `golden_item`, `golden_expected_source`, `eval_run`, `eval_result` — one numeric column per RAGAS-style metric. |
| **Graph `:DEPENDS_ON`** | The catalog graph has only `PART_OF` (containment) → can't answer "what depends on Drizzle?". Earns its keep only with a `:DEPENDS_ON` edge + an `:Entity-[:ABOUT]->:Resource` bridge. `:Entity` and `:Resource` stay separate. |
| **Per-surface request schemas** | Split `ChatRequestSchema` per surface so rag-demo knobs (tiers, rerank toggles) can't leak into the product chatbot. Low-risk: clients send a superset, ignore extras. |
| **`/admin/ai/rag/health`** | New endpoint = the wired-vs-scaffold board (above) made live + per-tier contribution telemetry. Surfaces the `*_SCAFFOLD` sentinels the UI and these docs both cite. |
| **Per-locale tsvector** | The BM25 `tsvector` is English-only across a tri-locale (en/de/ru) app → a `CASE`-on-`locale` generated column keyed off `document.locale` / `chunk.locale`. |

---

## Tooling rationale

| Choice | Verdict |
|--------|---------|
| **Hand-rolled (no LangChain / LlamaIndex)** | **Right call.** The TS RAG framework ecosystem is 18–24 months behind Python and a framework graveyard at this scale. Hand-rolled keeps every seam inspectable — which is the whole point of a showcase. |
| **pgvector / Neon** | Fine at this scale (nowhere near the 5–10M-vector range where dedicated stores matter). Caveat: disable Neon auto-suspend or the HNSW index pays a cold-start penalty on the first query. |
| **Neo4j (graph tier)** | ~Zero value for single-hop docs Q&A (GraphRAG-Bench: vanilla **60.92** vs MS-graph **49.29**). Earns its keep **only** for multi-hop dependency queries ("what depends on Drizzle?") — hence `:DEPENDS_ON` is the one graph investment worth making. |

The research line throughout: **fix the food, not the framework.** Self-contained chunks, contextual prefixes, an overview anchor, README exclusion, hybrid BM25, step-back, a reranker, and a golden-set eval all outrank any amount of orchestration cleverness. The summary/pointer layer is the last thing to invest in, and only behind a lint net.

---

## Phased roadmap

> **Everything past Phase C is DESIGNED, not built.** Phase C **landed and was browser-verified on 2026-06-25**; it is migration-free (no `db:push` — every column already exists) and its only deploy action is re-running `db:ingest-docs`. The rest is captured here so the decisions don't evaporate.

### Phase C — Foundation (BUILT + browser-verified 2026-06-25, migration-free)

The three quick-wins, independently the right foundation. Steps 2 + 3 share one orchestrator edit hotspot (the `Promise.allSettled` grounding block) and landed in one pass. All three are live — 5/5 functional probes green on 2026-06-25, with honest "I don't have that in the provided documentation" on out-of-corpus questions (no fabricated paths or numbers).

| # | Step | Effect | Status |
|---|------|--------|--------|
| 1 | **Unify the ingest door** — `ingest-docs.ts` reuses pure Vite-free `planChunks` + `rag-shared/embed-config.ts`. | Writes hierarchical section-parents + paragraph-children. **Groundwork only** — makes tier-2 *eligible*; does not change chatbot answers (chatbot is tier-1-only). Zero query-path change. | BUILT · corpus 36/93 (partial, quota-gated, resume-safe) |
| 2 | **Embed-retry + loud tracing** — bounded retry/backoff in `embed.ts`; add the missing rejected branch in the orchestrator. | Kills silent ungrounding; a 429 becomes an observable `{step:'embed', status:'error'}`. | BUILT |
| 3 | **Owner-aware overview + write the system anchor** — `getOverview(ownerIds)`; write the deterministic system-overview row; inject the `<project-overview>` block. | **The load-bearing fix** for "how do I use v10r?". Embed-independent — lands even when embed quota is exhausted. | BUILT · verified |

### Beyond Phase C (designed, not built)

| Order | Item | Status |
|-------|------|--------|
| 4 | **Retrieval-strategy orchestrator split** — extract `rawrag/strategy/chatbot-context.ts` FIRST; it unblocks the eval harness and the reranker slot. | DESIGNED |
| 5 | **Step-back query-transform + reranker** — both gated on broad-query intent + quota, both with deterministic/identity fallback. | DESIGNED |
| 6 | **llmwiki compile + recompile job** — auto-generate page TLDR/body/pointers from rawrag chunks; drift→recompile via the existing `source_hash_at_compile` detector. | DESIGNED |
| 7 | **lint nightly** — must be scheduled and green **before** llmwiki is promoted to the default answer surface (flat net is the guarantee until then). | DESIGNED |
| 8 | **eval schema + golden-set harness** — `eval` pgSchema cluster; 202+poll admin endpoints (reuse the `/admin/db` run pattern, Idempotency-Key). | DESIGNED |
| 9 | **Graph `:DEPENDS_ON` + docs entity tier** — earns tier-3 its keep for multi-hop dependency queries; heavier (needs a Neo4j driver in the script). | DESIGNED |
| 10 | **Per-locale tsvector** — `CASE`-on-`locale` generated column. | DESIGNED |
| 11 | **Fabricated-telemetry fix** — stop emitting the phantom `vectorHits`/`bm25Hits` split; emit real per-tier contribution. | DESIGNED |

### Open product decisions

| Decision | Recommendation | Why |
|----------|----------------|-----|
| **Recompile trigger** (eager / nightly-batched / lazy-on-read) | **Nightly-batched** | All three amplify LLM calls against a 20-req/day ceiling; batching is the only one that survives the quota. |
| **Per-surface request schema split** | **Proceed** | Low-risk — clients send a superset and ignore extras; the win (knobs can't leak to the product chatbot) is worth it. |
| **Admin endpoint versioning** | **Unversioned** | Matches existing admin precedent (`/admin/db`, `/admin/ai/*`). |

---

## Related

- [layered-rag.md](./layered-rag.md) — the two-layer split, read path, tool contracts, catalog grounding, graph tenancy. **The primary RAG doc.**
- [surfaces.md](./surfaces.md) — chatbot vs deskbot; the one-kernel/two-profiles model.
- [graph-rag.md](./graph-rag.md) — rawrag internals; the catalog `:Resource` seed; the hybrid pipeline.
- [README.md](./README.md) — AI blueprint nav hub.
