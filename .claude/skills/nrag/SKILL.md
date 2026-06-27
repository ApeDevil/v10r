---
name: nrag
description: Velociraptor's own RAG/nRAG retrieval-and-grounding subsystem — the rawrag engine, the llmwiki pointer layer, the three tiers, RRF fusion, the deterministic system-overview anchor, the ingest door, and the Gemini free-tier quota discipline that governs all of it. Use for ANY work on this project's retrieval or grounding: chatbot/deskbot grounding, ingest/chunking/embeddings, tiers, citations, the overview anchor, or budgeting LLM calls. This is project-truth and is authoritative for v10r RAG — it supersedes the generic `ai-tools/rag.md` reference (which still describes a renamed/older layout).
---

# nRAG — Velociraptor's retrieval & grounding subsystem

This is the **project-specific** companion to the generic `ai-tools` skill. `ai-tools` teaches portable Vercel-AI-SDK/RAG practice; **this skill teaches how *our* retrieval actually works** so you stop re-deriving it every session. Where they disagree about v10r, this skill wins.

> **Authoritative note — the rename.** The retrieval engine lives in `src/lib/server/rawrag/`. The generic `ai-tools/rag.md` still points at `src/lib/server/retrieval/` (6 dead paths) and calls BM25 "a gap" — both are **stale**. Trust the paths and facts in *this* file.

> **"nRAG" is an informal umbrella term** for the whole retrieval subsystem — there is **no `nRAG` code symbol**. The engine entry point is `rawrag/retrieve()`. The subsystem spans the `rawrag` engine **and** the `llmwiki` pointer layer. A definition naming only one is incomplete. Canonical: `docs/blueprint/ai/surfaces.md` (§ "nRAG: one shared kernel, two profiles, two corpora").

---

## 0. The one constraint that governs everything: Gemini free-tier quota

Every design decision here bends to a **hard daily request ceiling**. Internalize this before anything else.

- **Chat generation** (`gemini-2.5-flash`): a *low* daily ceiling. The project has observed exhaustion around ~20/day; current Google docs read higher (~250 RPD) after a **December 2025 free-tier quota cut**, and the exact number depends on the key/project. **Treat chat-gen as scarce; verify the live limit in [AI Studio rate-limit dashboard](https://aistudio.google.com/rate-limit) before assuming.**
- **Embeddings** (`gemini-embedding-001`, 1536-dim): observed ≈**1000/day**, shares the same Google key, and Google does **not** publish a specific embedding RPD — so this is an empirical, not documented, ceiling. Resets at **Pacific midnight ≈ 07:00 UTC**.

**The three rules that follow from the ceiling:**

1. **Deterministic first.** The cheapest answer makes **zero** LLM/embed calls. The system-overview anchor (a plain DB read) and catalog browse (a DB scan) answer the broadest questions for free. This is the single most important survival pattern — a rule-based pre-route to a cached/static answer before touching the pipeline.
2. **Every enhancement needs a deterministic identity fallback.** Reranker → degrade to fusion order. Step-back → degrade to the original query. llmwiki → degrade to flat `retrieve()`. **No quality feature may sit on a required path.**
3. **A daily-quota 429 is NOT retryable in-cycle.** `RESOURCE_EXHAUSTED` on the *daily* limit only resets at midnight PT — exponential backoff just wastes the user's time. Fail fast with an honest message; only retry per-minute (RPM) throttling. (Current `RETRYABLE_EMBED_ERROR = /quota|rate|429|RESOURCE_EXHAUSTED/i` in `rawrag/embed.ts` does **not** distinguish daily from RPM — the generous 6-attempt batch budget can burn minutes on a daily-exhausted key. Known sharp edge.)

**Budget math to quote when proposing features:** at a ~20–250/day chat ceiling, *every per-turn LLM call is 0.4%–5% of the entire day*. Multi-step agentic retrieval (3–5 calls/turn) exhausts the budget in a handful of turns. **Agentic/self/corrective-RAG loops are infeasible as the default path** — design for one retrieval + one generation.

---

## 1. The subsystem map

```
                       ┌── llmwiki (pointer layer): curated TLDR + chunk-pointers
                       │     over immutable rawrag chunks. EMPTY in prod today.
  retrieve(query,opts) ┤
   (rawrag/index.ts)   └── rawrag engine: embed → tiers (parallel) → RRF fuse → drill
```

### rawrag engine — `src/lib/server/rawrag/`
`retrieve(query, options, onEvent?)` (`index.ts:68`) is the pipeline. Stages, each independently testable:

1. **embed** — `rawrag/embed.ts`: `generateEmbedding` (interactive, tight retry) / `generateEmbeddings` (batch, generous retry). `incrEmbeddingCalls(1)` fires **once per success** (from `$lib/server/ai/provider-usage`).
2. **tiers (run in parallel)** — selected by `options.tiers?: (1|2|3)[]`:
   - **Tier 1 — contextual hybrid** (`tiers/contextual.ts`): pgvector cosine **+ keyword** (the `search_vector` tsvector column). BM25-style keyword is **built**, not a gap — it rescues exact identifiers/code/version strings that dense search misses.
   - **Tier 2 — parent-child** (`tiers/parent-child.ts`): filters `parent_id IS NOT NULL`; embeds **children** (precision), returns **parents** (context). Section parents are stored with `embedding=NULL` so tier-1 never surfaces them.
   - **Tier 3 — Neo4j graph** (`tiers/graph.ts`): vector seed → entity → graph traversal. `graphDepth` capped low (Aura Free).
3. **fuse** — `fuseAndRank(allChunks, maxChunks)` (`rank.ts:56`), **RRF** `score = 1/(RRF_K + rank + 1)`, `RRF_K = 60` (`rawrag/config.ts`). Pure in-memory; degrades to passthrough when only one tier has results.
4. **drill** — fetch-by-id expansion of selected chunks (bypasses ranking).

**LIVE vs scaffold (be honest — this matters):**
- The **floating chatbot widget requests tier-1 only**: `retrieve(userMsgText, { userId: SYSTEM_DOCS_USER_ID, tiers: [1], maxChunks: 4 })` (`chat-orchestrator.ts:617`). **Tiers 2–3 are unexercised by the chatbot today.**
- The **docs-corpus graph tier is dormant** (docs aren't entity-seeded). The **catalog `:Resource` graph IS seeded** (`db:catalog-sync`) — tier-3 earns its keep only for catalog multi-hop, not docs Q&A.
- **llmwiki pages are empty in prod** — the compile/recompile pipeline is a scaffold. So llmwiki's value today is the **overview anchor only** (below), not curated pages.

### The two surfaces (one engine, two profiles) — see `surfaces.md`
| | **chatbot** | **deskbot** |
|---|---|---|
| Role | v10r expert, read-only grounded Q&A | in-desk operator, mutating, plan-gated |
| Corpus | system-owned `docs`+`catalog` (`SYSTEM_DOCS_USER_ID`) + per-user llmwiki | the user's **own** desk files |
| Tiers today | tier-1 only | 1–2 (no graph) |
| Tenant isolation | single owner filter on the denormalized `chunk.user_id` (copied from `document.userId` at ingest, indexed) — still the tenant boundary; keeping the two in sync is now part of its integrity | same kernel, never forked (a duplicated/forked filter = cross-tenant leak risk) |

---

## 2. The grounding stack (how a turn actually gets context)

1. **System-overview anchor** — the load-bearing fix for broad questions ("how do I use v10r?", "which stack?"). A single `rag.llmwiki_page` row, `kind='overview'`, `user_id='system-docs'`, `collection_id='project-docs'`, injected into the chatbot system prompt as `<project-overview>`. It is **deterministic and embed-free** — a plain DB read via `loadOverview([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID)` — so it grounds broad questions **even when embed quota is exhausted**. Built by `writeSystemOverview()` → `buildOverviewBody()` (`scripts/db/ingest-docs.ts:299` / `src/lib/server/docs/overview-body.ts:54`).
2. **Relevance-gated system-docs prefetch** — tier-1 retrieve over the system corpus, gated so it only fires for broad/grounding-worthy turns.
3. **Deterministic context prefixes** — each child chunk's `context_prefix` is a **heading breadcrumb** (`${doc.title} › ${deepestHeading}`), computed at ingest by scanning ATX headings. This is the **zero-LLM substitute** for Anthropic's per-chunk contextual prep (which is quota-prohibitive here). It captures heading ancestry, *not* intra-section semantics — a smaller, unquantified win vs. the LLM version's −35/−49/−67% failure-rate ladder.
4. **Citation verification** — `src/lib/server/llmwiki/verify.ts` classifies each expanded chunk against the answer text, **no LLM call**. Verdicts: **`verbatim` | `paraphrase` | `drifted`** (and `none` for chunks the model didn't expand). Surfaced as citation chips. **This checks citation-faithfulness (did the answer cite the right chunk), NOT claim-faithfulness (did the answer invent an uncited claim)** — a real gap to keep in mind.

---

## 3. The ingest door (the only "deploy" for grounding)

There are **no migrations** for this — the only deploy action is re-running ingest.

- **`bun run db:ingest-docs`** (`scripts/db/ingest-docs.ts`) is the door for the docs corpus. It reuses the **pure** chunking core `planChunks()` (`rawrag/plan.ts`) and the **SSOT** tuning constants from `src/lib/server/rag-shared/embed-config.ts`:
  `EMBEDDING_MODEL='gemini-embedding-001'`, `EMBEDDING_MODEL_ID='google-gemini-embedding-001'`, `EMBEDDING_DIMENSIONS=1536`, `SECTION_CHUNK_TARGET=1000`, `PARAGRAPH_CHUNK_TARGET=300`, `CHUNK_OVERLAP=50`. (`embed-config.ts` is a Vite-free leaf — no `$lib`/`$env`/`import.meta` — so the Bun script can import it. Keep it that way.)
- **`RAG_ONLY_BLOCK`** (in the ingester) + **`BLOCKLIST`/`isBlocked()`** (`src/lib/server/docs/doc-filter.ts`, the SSOT) make grounding **asymmetric**: some docs render at `/docs` for humans but are withheld from chatbot grounding (planning/aspirational docs like `knowledge-base.md`, `rag-roadmap.md`) — so the assistant never asserts unbuilt features as live. When adding a planning doc, add it to `RAG_ONLY_BLOCK`.
- **Embedding reuse:** chunks carry a `content_hash`; unchanged content is skipped on re-ingest. Never re-embed what hasn't changed — it's the highest-value embed-quota saving. (Current skip granularity is coarse — per-document — a known place to tighten.)
- **Resume safety:** ingest is `ON CONFLICT DO NOTHING` / idempotent; a crash mid-run (e.g. quota 429) leaves a partial index. `writeSystemOverview()` runs **last** (`:394`), idempotent delete-then-insert keyed on `collection_id`, so a mid-embed crash leaves the live anchor untouched.

### Read-truncation hazard (the bug that ate the stack answer)
`OVERVIEW_MAX_TOKENS = 500` (`llmwiki/config.ts:15`) × `CHARS_PER_TOKEN = 4` (`overview.ts:14`) → `loadOverview` truncates the stored overview body to **2000 chars at read time**. Anything below the cut never reaches the model. **Put load-bearing facts (e.g. the `**Stack:**` line) near the top of the body, above ~char 320 — not in a section that sorts last.** Don't raise `OVERVIEW_MAX_TOKENS` casually; it's the injected-prompt budget.

---

## 4. Settled calls (decided — don't re-litigate; cite the evidence)

- **GraphRAG hurts single-hop fact retrieval.** GraphRAG-Bench (ICLR'26): vanilla+rerank **60.9%** vs MS-GraphRAG **49.3%** on fact retrieval. Graph wins only on multi-hop/cross-doc synthesis. → Our dormant docs-graph tier is **correct** prioritization; graph is for the catalog `:Resource` edges, not docs Q&A.
- **Deterministic heading-breadcrumb prefixes**, not per-chunk LLM contextual prep. Quota-correct; revisit only on a paid tier with prompt caching.
- **HyDE: avoid.** It embeds its *own* hallucination (fact-bound queries land in the wrong neighborhood), +25–60% latency, doubles LLM calls. **Step-back** is the safer broad-query transform — but gate it on quota and feed the *generalized* query to embedding while the *original* query feeds any reranker.
- **Reranker = deterministic z-score fusion first** (zero quota), local cross-encoder second (CPU, zero API quota), cloud reranker last (separate quota). ARAGOG caveat: cloud rerankers don't *always* beat naive fusion — corpus-model fit decides.
- **Parent-child + RRF k=60 + hybrid dense/keyword** are the production-validated baseline. We have them. k=60 is a smoothing constant, not a quality lever — don't tune it expecting gains.

---

## 5. Durable practice worth keeping (post-cutoff; overrides stale training)

- **AI SDK is pinned `^6`. Do NOT naively upgrade to v7** — v7 renames `system→instructions`, `onFinish→onEnd`, `fullStream→stream` and requires Node 22. These silently break the system-prompt path. Migrate deliberately, not via `^`.
- **`onFinish` is fire-and-forget** — the SDK does not await it; a throw is swallowed and serverless may recycle before a DB write lands. Use it for best-effort telemetry; for critical persistence use a pre-create + awaited path.
- **Metadata-before-`start`-frame splits the message.** Writing message-metadata before the text stream's `{type:'start'}` frame makes AI SDK v6 emit **two** messages (the empty-duplicate-avatar bug we already hit and fixed). Rule: open your own `start` frame first, then metadata, then `toUIMessageStream({ sendStart: false })`. The desk branch (metadata after start) is safe.
- **"No evidence, no answer."** A system-prompt abstention clause ("if the context doesn't answer it, say so — don't fabricate") cuts hallucination more than any retrieval trick, and it's free.
- **Lost-in-the-middle:** when assembling context, put the highest-ranked chunk **first** and the second-highest **last**. Free +10–15% on long contexts.
- **The embedding model is load-bearing infrastructure.** `1536`-dim `gemini-embedding-001` is baked into the index. Switching models means a **full corpus re-embed** at ~1000/day — budget it like a schema migration, never mix old/new vectors in one index.

---

## 6. Scope boundaries (route elsewhere)

- Vector index **schema** / embedding storage tables → **daty**.
- API **wire contract** for AI endpoints (SSE shape, request schema) → **apy** (nRAG designs the retrieval/SDK call; apy designs the contract).
- SvelteKit **route** structure for AI features → **svey**.
- **Test design** for retrieval → **tesy**. (Tests use the PGlite `pushSchema` harness in `src/lib/server/test/db.ts`.)
- **Security review** of auth/tenant-isolation on AI endpoints → **secy**. (The single `user_id` filter is the tenant boundary — a duplicated/forked filter is the cross-leak risk to flag.)
- A **live failure** ("retrieval 500s right now") → **tray**, not here.

## Quick reference — grounded identifiers

| Thing | Where | Fact |
|---|---|---|
| Engine entry | `rawrag/index.ts:68` | `retrieve(query, options, onEvent?)` |
| Tiers | `rawrag/tiers/{contextual,parent-child,graph}.ts` | selected by `options.tiers: (1\|2\|3)[]` |
| Fusion | `rawrag/rank.ts:56` | `fuseAndRank`, `RRF_K=60`, `1/(RRF_K+rank+1)` |
| Embed | `rawrag/embed.ts` | `generateEmbedding`/`generateEmbeddings`; `incrEmbeddingCalls(1)` per success |
| Chunk plan (pure) | `rawrag/plan.ts` | `planChunks(content, {sectionTarget, paragraphTarget, overlap})` |
| Config SSOT | `rag-shared/embed-config.ts` | dims `1536`, section `1000`, paragraph `300`, overlap `50` |
| Identity | `config.ts:84,87` | `SYSTEM_DOCS_USER_ID='system-docs'`, `PROJECT_DOCS_COLLECTION_ID='project-docs'` |
| Overview anchor | `docs/overview-body.ts:54`, `scripts/db/ingest-docs.ts:299` | deterministic, embed-free, injected as `<project-overview>` |
| Read truncation | `llmwiki/config.ts:15` + `overview.ts:14` | `500 × 4 = 2000`-char cap at read |
| Citations | `llmwiki/verify.ts` | verdicts `verbatim`/`paraphrase`/`drifted`/`none`, no LLM |
| Grounding gate | `chat-orchestrator.ts:617` | chatbot prefetch = `tiers:[1], maxChunks:4` |
| Blocklist SSOT | `docs/doc-filter.ts` + `RAG_ONLY_BLOCK` | render-at-/docs but withhold-from-chatbot is asymmetric |
| Surfaces contract | `docs/blueprint/ai/surfaces.md` | chatbot vs deskbot, the nRAG profiles |
