# RAG Roadmap — the three LLM-amplifying retrieval features

The detailed companion to [knowledge-base.md](./knowledge-base.md). That blueprint maps the whole subsystem and marks what is wired versus scaffold; this doc specs the three features that the Phase C foundation precedes: a **reranker**, a **step-back query-transform**, and the **llmwiki auto-compile + recompile loop**.

> **Everything in this doc is DESIGNED, NOT BUILT.** No retrieval source code exists for any of it yet — the reranker slot, the step-back gate, and the compile pipeline are all specifications, not files. The reranker has no module; step-back has no function; `llmwiki/compile/index.ts` and `llmwiki/lint/index.ts` are empty `*_SCAFFOLD = true` sentinels. This doc is in the [`RAG_ONLY_BLOCK`](../../../scripts/db/ingest-docs.ts) set so the chatbot cannot assert these specs as shipped. Build only after Phase C lands.

---

## Why quota leads every spec

The hard constraint dwarfs every quality consideration:

| Resource | Ceiling | Failure mode |
|----------|---------|--------------|
| **Chat generation** (gemini-2.5-flash, free tier) | **~20 requests / DAY** | 503 / `RESOURCE_EXHAUSTED` when exhausted — the whole turn dies |
| **Embeddings** (gemini-embedding-001) | Shares the **same** Google key as chat | a 429 here ungrounds the turn — was the [worst showcase failure](./knowledge-base.md#wired-vs-scaffold-the-honest-map) when silent; now retried + traced loudly (`{step:'embed', status:'error'}`) after Phase C step 2 (2026-06-25) |

Twenty requests a day is not a rate limit you tune around — it is a budget you cannot dogfood past. A feature that spends one LLM call per turn burns the entire day in twenty turns. Therefore **every spec below leads with its quota budget**: when it fires, what is cached, and the deterministic fallback that runs when quota is gone. The rule throughout: **the no-cost path is the default; the LLM path is the ceiling.** A quota-exhausted turn must still answer — degraded, honestly labelled, never broken.

This inverts normal RAG design priorities. The reranker's default is not Cohere; it is a local z-score fusion. Step-back's default is a no-op pass-through. The compile loop's trigger is not eager; it is nightly-batched. The cloud/LLM variants are documented as the quality ceiling you reach for **only** when a paid key or prompt caching changes the economics.

---

## 1. Reranker

Reorders fused candidates by query-relevance before context assembly. The single highest-quality-per-token lever in the research: **Voyage rerank-2 gave +13.89% NDCG@10** over fusion order, and the ARAGOG ablation survey ranks a reranker above almost every other retrieval refinement. It works by widening the candidate net (retrieve more) and narrowing the output (rerank to fewer, better) — fusion ranks are coarse; a reranker scores each candidate against the actual query.

### (a) Quota budget

| Path | Cost per turn | When |
|------|---------------|------|
| **Deterministic z-score fusion (DEFAULT)** | **0 LLM, 0 embedding, 0 network** | every turn |
| Local cross-encoder (optional) | 0 API quota (CPU only) | every turn, if a local model is provisioned |
| Cloud reranker — Cohere / Voyage (CEILING) | 1 rerank API call (separate quota from chat-gen) | only when a paid rerank key is set |

The default spends **nothing**. Reranking is a pure reordering of candidates the pipeline already has in hand — fusion already produced scored chunks; the deterministic reranker just re-scores them with a better-normalized signal. There is no per-turn LLM or embedding cost, so it runs on **every** turn regardless of the chat-gen quota state. This is the point: the reranker is the one quality lever that survives a fully-exhausted day.

**Caching.** None needed for the deterministic path (it is recomputed cheaply per turn). A cloud reranker, if ever wired, would cache by `hash(query + sorted candidate ids)` with a short TTL — but that is ceiling-only.

**Deterministic fallback (and the default).** When no reranker model is available — which is the steady state — `rerank()` returns candidates in **fusion order, unchanged** (identity). The deterministic default goes one step better than identity: it re-normalizes each tier's raw scores to z-scores before comparing, so a tier-1 vector score and a tier-2 parent-child score are compared on the same scale rather than by RRF rank alone. This is free and strictly better than raw fusion order for multi-tier results. The cloud reranker is the quality ceiling; the local z-score fusion is the floor you never fall below.

### (b) The seam

Slots into `retrieve()` **between fusion and context assembly** — exactly where the blueprint's seam diagram places it. In [`src/lib/server/rawrag/index.ts`](../../../src/lib/server/rawrag/index.ts):

- `fuseAndRank(allChunks, opts.maxChunks)` is called at **`index.ts:152`** (today inside the `--- Rank ---` block).
- Context assembly begins at the `--- Context assembly ---` block (`index.ts:172`).

The reranker plugs in **between** those. The change to the existing code is to widen the fusion candidate cap (retrieve-wide), rerank, then cap to `maxChunks` (rerank-narrow):

```ts
// rawrag/rerank.ts  (NEW — pure module, no chat-orchestrator import, per ARY home rule)
export interface RerankOptions {
  /** Final count after reranking. Defaults to the retrieval maxChunks. */
  topN: number;
}

/**
 * Reorder candidates by relevance to `query`. Returns a re-sorted slice of
 * length ≤ topN. NEVER throws — on any reranker failure or absence, returns
 * the input candidates in fusion order, capped to topN (identity fallback).
 */
export async function rerank(
  query: string,
  candidates: RankedChunk[],
  opts: RerankOptions,
): Promise<RankedChunk[]>;
```

Call-site shape in `retrieve()` (replacing the single `fuseAndRank` call):

```ts
// retrieve-wide: fuse to a wider candidate pool than the final cap
const RERANK_CANDIDATE_CAP = Math.max(opts.maxChunks * 3, 20); // e.g. 12 → up to 36
const { chunks: fused } = fuseAndRank(allChunks, RERANK_CANDIDATE_CAP);

// rerank-narrow: reorder, then cap to the real budget
const chunks = await rerank(query, fused, { topN: opts.maxChunks });
```

| | Input | Output |
|---|-------|--------|
| `rerank(query, candidates, {topN})` | the original query string (NOT a step-back-generalized one — see §2), fused `RankedChunk[]` (wide), `topN` | a relevance-reordered `RankedChunk[]` of length ≤ `topN` |

**Candidate budget (retrieve-wide → rerank-narrow).** Fusion produces ~`3 × maxChunks` candidates (capped, say, at 36); the reranker scores all of them and returns the top `maxChunks` (e.g. 12). Wider input is where the quality comes from — the reranker can only promote a chunk fusion ranked low if fusion surfaced it at all. The cost of "wide" is bounded because the deterministic default is free; the cloud ceiling is what makes a wide candidate set expensive, so the wide cap is itself a knob a cloud reranker would tighten.

### (c) Failure / observability

The reranker emits its own pipeline stage so the showcase tells the truth ("a blank stage is a lie; a skipped stage is the lesson"):

- `{ type:'pipeline:step', step:'rerank', status:'active' }` on entry.
- `status:'done'` with a detail carrying `{ kind:'rerank', method:'zscore' | 'cross-encoder' | 'cohere', inputChunks, outputChunks }`.
- `status:'skipped'` when no candidates exist to rerank (single-tier, empty fusion).
- `status:'error'` (with `error?:string`) when a cloud/local model call fails — **and then it falls back to identity**, so an error stage is followed by a normal `context` stage, never a dead turn.

Degradation is total and silent-to-the-user: a reranker error reorders nothing and the fusion-ordered candidates flow through unchanged. The only observer is the pipeline event. This matches `retrieve()`'s existing per-tier `try/catch` that returns `[]` on tier failure (`index.ts:136`) — same discipline, applied to the new stage. The `method` field in the done-detail is the honest signal of which path actually ran (`zscore` = the free default; `cohere`/`voyage` = the ceiling).

### (d) Phase-C dependencies

- **Step 4 (retrieval-strategy extraction).** The reranker needs a slot to live in. Today `retrieve()` is a monolith and the call site is wedged between two emit blocks; extracting `rawrag/strategy/chatbot-context.ts` (Phase C-adjacent, "extract FIRST" per the roadmap) gives the reranker a clean seam. Until that extraction, the reranker can land directly in `retrieve()` at `index.ts:152` — it does not strictly require the split, but the split makes it testable in isolation.
- **No dependency** on embed-retry or owner-aware overview — the reranker is downstream of fusion and orthogonal to grounding.

---

## 2. Step-back query-transform

One LLM call **before embed**, for BROAD queries only, that rewrites a specific question into a more general one so embedding lands on high-level overview chunks instead of narrow leaves. This is the fix for the "how do I use v10r?" class — a broad question whose best answer is the overview, not a paragraph about one config flag. DeepMind's step-back prompting reports **+7–27%** on reasoning-heavy retrieval. It is the inverse risk profile of HyDE: **HyDE hallucinates a fake answer document to embed** (and embeds the hallucination's errors), whereas step-back only *generalizes the question* — strictly safer, because a generalized query cannot inject fabricated facts the way a hypothetical answer does.

### (a) Quota budget

| Path | Cost per turn | When |
|------|---------------|------|
| **No-op pass-through (DEFAULT for non-broad turns)** | **0 LLM** | every specific/narrow query (the majority) |
| Step-back transform | **1 chat-gen LLM call** (against the ~20/day ceiling) | only when the broad-query gate fires AND quota remains |
| Quota-exhausted broad turn | **0 LLM** | broad query, but chat-gen is exhausted → no-op fallback |

This is the most quota-sensitive of the three, because it spends the **scarce** resource (chat-gen, 20/day) not the reranker's free one. The budget is **strictly 1 call per broad turn, 0 otherwise**. The gate (below) is what keeps it from firing on the common case. A single greeting or a specific lookup spends nothing.

**Caching.** Step-back outputs are cached by `hash(normalized userMsgText)` with a multi-hour TTL (Redis, the existing embedding-counter store). Broad questions recur with high overlap ("how do I use v10r", "what is v10r", "getting started") — caching collapses repeat broad turns to 0 LLM calls. This is what makes step-back affordable to dogfood: the *first* "how do I use v10r?" of the day costs 1 call; the next ten cost nothing.

**Deterministic fallback (the no-op).** When the gate does not fire, OR the cache misses AND chat-gen quota is exhausted, `maybeStepBack` returns `null` and the pipeline embeds the **original** query unchanged. There is no deterministic *generalization* (you cannot rewrite a query well without a model), so the fallback is honest: skip the transform, embed as-is. A broad query on an exhausted day still retrieves — just on the original phrasing, leaning on the system-overview anchor (Phase C step 3) to carry the high-level answer instead.

### (b) The seam

Slots **before embed** in the chatbot grounding path — it rewrites the query, so it must run before `generateEmbedding`. Two anchors:

- The **broad-query gate** mirrors `shouldGroundFromSystemDocs` at [`chat-orchestrator.ts:347`](../../../src/lib/server/ai/chat-orchestrator.ts). That function already classifies "is this a real question worth grounding?" (length ≥ 12, not a greeting). The step-back gate is a *narrower* sibling: "is this a real question AND a **broad** one?" — broad meaning short-and-general ("how do I…", "what is…", "getting started", "overview of…"), the class that benefits from generalization. Specific questions ("what's the default RRF k?") skip it — generalizing them would hurt.
- The embed call is `generateEmbedding(query)` at [`rawrag/index.ts:78`](../../../src/lib/server/rawrag/index.ts). In the chatbot path, the query reaching `retrieve()` is `userMsgText` (the `retrieve(userMsgText, …)` call at `chat-orchestrator.ts:617`). Step-back transforms `userMsgText` → a generalized query that is passed as the **retrieval** query, while the original `userMsgText` is retained for the reranker.

```ts
// rawrag/step-back.ts  (NEW — pure module)
/**
 * For BROAD queries only, return a generalized query that embeds better against
 * high-level overview chunks. Returns null for narrow queries, on cache-or-
 * quota-miss, or on any LLM failure (no-op fallback — embed the original).
 * Spends at most ONE chat-gen call, cached by normalized text.
 */
export async function maybeStepBack(text: string): Promise<string | null>;

/** The gate. Mirrors shouldGroundFromSystemDocs — broad-question subset. */
export function isBroadQuery(text: string): boolean;
```

**Critical: the original query feeds rerank; the generalized query feeds embed.** This is the load-bearing wiring detail. The generalized query is *only* used to compute the embedding (it pulls in the right high-level neighborhood); the **reranker in §1 still scores candidates against the ORIGINAL `userMsgText`**, because relevance must be judged against what the user actually asked, not the generalized stand-in. So:

```
userMsgText ──┬─→ maybeStepBack() ─→ generalizedQuery ─→ generateEmbedding() ─→ tiers ─→ fuse
              └────────────────────────────────────────────────────────────────────────────→ rerank(userMsgText, fused)
```

| | Input | Output |
|---|-------|--------|
| `isBroadQuery(text)` | `userMsgText` | boolean (gate) |
| `maybeStepBack(text)` | `userMsgText` (broad) | generalized query string \| `null` |

Because `retrieve()` today takes a single `query` used for both embed and (future) rerank, wiring this cleanly is a reason the **retrieval-strategy extraction (Phase-C step 4) should land first** — the extracted strategy module can carry both `embedQuery` (generalized) and `rerankQuery` (original) explicitly, rather than overloading the one `query` param.

### (c) Failure / observability

Emits a stage before embed:

- `{ step:'step-back', status:'skipped' }` for narrow queries (the gate said no) — the showcase shows it considered and declined, honestly.
- `status:'done'` with `{ kind:'step-back', original, generalized, fromCache }` when it fired — so the viz can show the rewrite and whether it cost a call.
- `status:'skipped'` with a reason when broad but quota-exhausted (`reason:'quota'`) — distinct from the gate-skip, so the showcase distinguishes "didn't need it" from "couldn't afford it."
- On LLM error: `status:'error'` then no-op (embed original). Never blocks the turn.

The honesty win is the `fromCache` / `reason:'quota'` distinction — the showcase can show that step-back is *quota-aware*, not just on/off.

### (d) Phase-C dependencies

- **Step 3 (system overview anchor)** is the safety partner. When step-back is *skipped for quota* on a broad turn, the system-overview anchor injected in Phase C step 3 is what still answers the broad question. Step-back makes broad retrieval *better*; the overview anchor makes broad retrieval *not fail* when step-back can't run. They are complementary, and step-back is only safe to ship because the anchor backstops it.
- **Step 2 (embed-retry).** Step-back changes *what* you embed but still funnels through `generateEmbedding`; it inherits the Phase-C-step-2 retry/backoff. Do not re-derive retry here — the embed it calls is already hardened.
- **Step 4 (strategy extraction)** to carry `embedQuery` vs `rerankQuery` without overloading `retrieve()`'s `query` param (see seam).

---

## 3. llmwiki auto-compile + recompile loop

Replaces the [`COMPILE_SCAFFOLD`](../../../src/lib/server/llmwiki/compile/index.ts) and [`LINT_SCAFFOLD`](../../../src/lib/server/llmwiki/lint/index.ts) sentinels with a real pipeline that **auto-generates** llmwiki pages from rawrag chunks and keeps them fresh as sources drift. This is the deferred tier-2 of the whole design and **the biggest quota consumer by far** — so its trigger decision is the most consequential quota call in this roadmap.

**Auto-generated, never hand-curated.** The research is unanimous: hand-curated summary layers rot (someone edits a doc, the curated page lies, and the summary silently hides the true chunk — the [recall-safety-net failure mode](./knowledge-base.md#the-recall-safety-net)). So pages are *compiled from chunks*, not written by hand. A page is one TLDR + body + tags over a cluster of related rawrag chunks, carrying `pointers:` (chunk ids) back down into the immutable rawrag layer. The page is the answer surface; the chunks are the audit trail.

### (a) Quota budget — the big one

**Cost per page.** Compiling one page is **1 chat-gen call** (generate TLDR + body from the source chunks) **+ 1 embedding call** (embed `title + tldr + tags`, per the schema's "embedded together" note and the `seed-llmwiki.ts` precedent). So **~2 quota units per page**, one against the scarce 20/day chat ceiling.

**Total corpus cost.** This is the alarming number. If the docs corpus compiles to ~N topic pages, the *full* corpus compile costs **N chat-gen calls** — and N is comfortably larger than 20. **A full corpus recompile cannot complete in a single day on the free tier.** This single fact dictates everything below.

| Trigger strategy | Quota behavior | Verdict |
|------------------|----------------|---------|
| **Eager** (recompile a page the moment a source chunk drifts) | a doc edit touching K pages spends K chat-gen calls *immediately, on the write path* — one big doc edit can exhaust the day's quota in a single ingest | **Rejected** — couples writes to the scarce quota; one edit can DoS the chatbot for the rest of the day |
| **Lazy-on-read** (recompile a stale page when it's next retrieved) | spends a chat-gen call *on a user's hot path*, mid-turn — adds latency and, worse, can 503 the user's turn when quota is gone | **Rejected** — puts the scarce, failure-prone resource on the interactive path; the exact thing the reranker/step-back specs work to avoid |
| **Nightly-batched (RECOMMENDED)** | a scheduled job recompiles up to a **fixed daily budget** of stale pages (e.g. ≤ 15/night, leaving headroom for interactive chat), oldest-drift-first | **Chosen** — the only strategy that survives 20/day; decouples compile cost from both writes and reads |

**Nightly-batched, with a hard daily page budget.** The recompile job runs off the hot path (cron / scheduled), drains the `stale = true` queue (the `llmwiki_page_stale_idx` partial index already exists for exactly this), and recompiles **at most a fixed number of pages per night** — sized to leave interactive chat headroom (if the day's chat budget is ~20, spend ≤ ~15 on compile, oldest-first). A corpus larger than the nightly budget converges over several nights rather than all at once; staleness is *eventually* repaired, never repaired *synchronously*. This is the only trigger that does not put the scarce resource on a write or a read path.

**Caching / dedup.** Before recompiling, the job re-checks the source-set hash — if a page was marked stale but its sources reconverged (an edit was reverted), it skips the compile (0 cost). Embeddings for unchanged `title+tldr+tags` are not recomputed. The nightly budget is spent only on pages whose source content actually moved.

**Deterministic fallback when quota is exhausted mid-batch.** If the nightly job hits a 429 partway through, it **stops cleanly**, leaves the remaining pages `stale = true`, and resumes next night. No page is left half-compiled (compile is per-page atomic: generate → embed → upsert in one transaction, or skip). The *read* side already has its deterministic fallback: a stale page still serves its **last good** TLDR (it is not deleted), and the **flat `retrieve()` net runs in parallel underneath llmwiki regardless** — so a stale or never-compiled page never gates recall. This is why llmwiki can be quota-starved without breaking the chatbot: the flat path is the floor.

### (b) The seam

Three insertion points, all replacing scaffolds or extending existing detectors:

**Compile** — replace `COMPILE_SCAFFOLD` in [`llmwiki/compile/index.ts`](../../../src/lib/server/llmwiki/compile/index.ts):

```ts
// Replaces `export const COMPILE_SCAFFOLD = true`
export async function compilePage(
  sourceChunks: RankedChunk[],   // a cluster of related rawrag chunks (one topic)
  kind: LlmwikiPageKind,         // 'page' | 'overview'
): Promise<LlmwikiPage>;
```

`compilePage` (1) calls chat-gen to synthesize `title + tldr + body + tags` from the chunk cluster, (2) embeds `title+tldr+tags` (1 embedding call, per the [`llmwiki-page.ts`](../../../src/lib/server/db/schema/rag/llmwiki-page.ts) "embedded together, 1536-dim" contract), (3) writes the page row **and** the `llmwiki_page_source` pointer rows. Each pointer row records `source_hash_at_compile = chunk.contentHash` per the [`llmwiki-page-source.ts`](../../../src/lib/server/db/schema/rag/llmwiki-page-source.ts) schema — this is the drift anchor. It also writes `source_count` and the page-level `source_hash` (the source-**set** hash) so the "sources added/removed" drift gap is closed, not just the "source content changed" one. The `search_vector` is app-populated via the `to_tsvector('english', …)` literal (the schema comment at `llmwiki-page.ts:48-57` is explicit that this is NOT a generated column).

**Drift → recompile** — the READ side exists in [`llmwiki/verify.ts`](../../../src/lib/server/llmwiki/verify.ts); the WRITE side does not:

- **Exists.** `verifyCitations` compares each drilled chunk's current `content_hash` against the recorded `source_hash_at_compile` (comparison at `verify.ts:65`) and returns `driftedChunkIds`. It is the module's only export, and it performs **zero writes**.
- **Does not exist.** `markPagesStaleForChunks(chunkIds)` — the write-side marker that would flip `stale = true` on every page citing a drifted chunk via the `llmwiki_page_source` junction. It has to be built.

The *substrate* is real, which is why this is a small build rather than a design problem: `llmwiki_page_source.source_hash_at_compile` ([`llmwiki-page-source.ts:33`](../../../src/lib/server/db/schema/rag/llmwiki-page-source.ts)), `llmwiki_page.stale` ([`llmwiki-page.ts:63`](../../../src/lib/server/db/schema/rag/llmwiki-page.ts)), and the partial index `llmwiki_page_stale_idx` (`llmwiki-page.ts:73`) that the drain queue would read.

So the **recompile loop is: ingest → (something flips chunks' hashes) → a drift sweep marks the citing pages stale → the nightly job drains `stale = true` and re-runs `compilePage` for each.** The read-side comparison exists today; what's missing is (1) `markPagesStaleForChunks` itself, (2) a sweep that compares *all* current chunk hashes against recorded ones after an ingest (not just chunks the model happened to drill — `verifyCitations` only covers drilled ids), and (3) the nightly drain. The sweep is a batch SQL join (chunk.content_hash ≠ llmwiki_page_source.source_hash_at_compile) — no LLM cost; only the *recompile* costs quota.

**Lint-nightly gate** — replace `LINT_SCAFFOLD` in [`llmwiki/lint/index.ts`](../../../src/lib/server/llmwiki/lint/index.ts):

```ts
// Replaces `export const LINT_SCAFFOLD = true`
export async function lintCollection(
  collectionId: string | null,
  userId: string,
): Promise<LlmwikiLintIssue[]>;
```

Lint is the **gate before llmwiki is promoted to a default surface**. It runs nightly (deterministic checks, ~0 LLM cost: orphan pages, broken wikilinks, compile-drift, stale-TLDR — the codes already enumerated in the scaffold comment). **llmwiki stays off the default answer path until lint is scheduled and green.** Until then the flat `retrieve()` net is the recall guarantee. This is the [load-bearing safety principle](./knowledge-base.md#the-recall-safety-net): a summary layer must never gate recall, and lint is what proves the summary layer is trustworthy enough to lead.

**Consuming the owner-aware overview (Phase C step 3).** The compile pipeline produces ordinary `kind='page'` rows; the **`kind='overview'` system anchor is written deterministically by `ingest-docs.ts` (Phase C step 3), not by `compilePage`** — the overview is a knowledge-map TOC, not an LLM synthesis, precisely to keep it quota-free. So compile reads the system overview (via the now owner-aware `getOverview(ownerIds)` — the [`queries.ts:198`](../../../src/lib/server/llmwiki/queries.ts) signature changes from `userId` to `ownerIds: string[]` in Phase C) as the **structural skeleton** it compiles pages *into*: the overview's TOC defines the topic clusters, and each cluster becomes one auto-compiled page. The overview is the table of contents; compiled pages are the chapters. This is why Phase C step 3 (owner-aware `getOverview` + a written system overview) is a hard prerequisite — without the anchor, compile has no topic structure to cluster against, and would have to invent clusters per-run (non-deterministic, quota-wasteful).

### (c) Failure / observability

- **Compile** is per-page atomic and emits a job-level event (admin surface, not the chat hot path): `{ kind:'compile', page, chatCalls, embedCalls, status }`. A page that fails to compile (LLM error, quota) stays `stale = true` and is retried next night — never half-written.
- **Drift sweep** emits `{ kind:'drift-sweep', pagesMarkedStale }` — honest count of how much the corpus moved.
- **Nightly budget exhaustion** emits `{ kind:'compile-batch', budgeted, compiled, remainingStale, stoppedReason:'budget'|'quota'|'done' }` — so the admin `/admin/ai/rag/health` board (designed in the blueprint) shows the convergence honestly: "12 of 47 stale pages recompiled tonight; 35 remain; stopped: budget." That honesty is the showcase — a compile loop that pretended the corpus was always fresh would lie about its own quota reality.
- **Read-side degradation** is invisible-and-safe: a stale page serves its last-good TLDR, the parallel flat `retrieve()` carries recall, and the page's `stale` flag is surfaced in its coverage (`getOverview` already returns `coverage.stale`, `queries.ts:231`).

### (d) Phase-C dependencies

- **Step 3 (owner-aware `getOverview` + written system overview)** — hard prerequisite. Compile clusters pages against the overview TOC; without the anchor there is no deterministic topic structure (see seam).
- **Step 1 (unified ingest door)** — hard prerequisite. Compile generates pages from rawrag chunks; those chunks must be the **hierarchical** ones (parents + children + breadcrumb prefixes) that Phase C step 1 produces. Compiling against today's flat docs chunks would produce thin, context-poor pages. Compile is only worth doing *after* the food is fixed.
- **Step 2 (embed-retry)** — the per-page embedding inherits the hardened `generateEmbeddings`; the nightly batch wants the *generous* retry budget (≥ 6 attempts) since it is off the hot path.
- **Step 4 (strategy extraction)** — softer dependency; compile lives in `llmwiki/`, not the retrieval strategy module, so it does not strictly block on the split.

---

## Build order + Phase-C dependencies

The three features layer onto the Phase C foundation in a strict order set by cost and prerequisite. The cheap, quota-free wins come first; the biggest quota consumer comes last and behind a lint gate.

```
Phase C (foundation, migration-free) ── MUST land first
  1. unified ingest door      → hierarchical docs chunks (compile food)
  2. embed-retry + tracing    → step-back & compile inherit hardened embed
  3. owner-aware getOverview  → step-back backstop + compile's topic skeleton
        │
        ▼
Phase B features (this doc), in cost order:
  4. retrieval-strategy split → gives reranker its slot + carries embedQuery vs rerankQuery
  5. RERANKER                 → 0-quota default; ships first because it survives an exhausted day
  6. STEP-BACK                → 1 scarce call/broad-turn, cached, gated, no-op fallback; needs step-3 backstop
  7. llmwiki AUTO-COMPILE     → biggest quota consumer; nightly-batched; needs steps 1+3
        │
        ▼
  8. lint-nightly (gate)      → green-and-scheduled BEFORE llmwiki becomes a default surface
```

| Feature | Per-turn quota (default path) | Hard Phase-C deps | Ship gate |
|---------|-------------------------------|-------------------|-----------|
| **Reranker** | **0** (z-score fusion) | step 4 (slot; soft) | none — safe to default-on, free |
| **Step-back** | **0** narrow / **1** broad (cached) | steps 2, 3, 4 | gated by `isBroadQuery` + quota check |
| **llmwiki compile** | **0** per turn (nightly job) | steps 1, 2, 3 | lint-nightly green before default-surface promotion |

The throughline: **reranker before step-back before compile**, because that is increasing order of how much of the scarce 20/day budget each touches — the reranker touches none, step-back touches one call per broad turn, and compile touches the whole budget nightly. Every one of them defaults to a no-cost or off-hot-path behavior, so a fully quota-exhausted day still produces a grounded, honestly-labelled answer. That is the dogfood test, and it is the only test that matters on a 20-request day.

---

## Related

- [knowledge-base.md](./knowledge-base.md) — the integrating blueprint + the wired-vs-scaffold honesty map. **Read this first.**
- [layered-rag.md](./layered-rag.md) — the two-layer split, read path, recall-safety-net detail.
- [graph-rag.md](./graph-rag.md) — rawrag internals the reranker reorders and compile reads from.
- [README.md](./README.md) — AI blueprint nav hub.
