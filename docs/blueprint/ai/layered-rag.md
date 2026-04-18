# Layered RAG

Two-layer retrieval: `llmwiki` is the primary answer surface; `rawrag` is the audit and drill-down trail.

> rawrag internals (chunking, embeddings, parent-child, graph traversal): see [graph-rag.md](./graph-rag.md).

---

## Layer Split

| Layer | Module | Role |
|-------|--------|------|
| **llmwiki** | `src/lib/server/llmwiki/` | LLM-compiled wiki pages. Primary retrieval surface. |
| **rawrag** | `src/lib/server/rawrag/` | Immutable source chunks. Drill-down trail and ground truth. |
| **tools** | `src/lib/server/ai/tools/` | AI SDK tool wrappers closing over `userId`. |

**Why two layers?** Wiki pages give the model a coherent, token-efficient answer surface — one TLDR per topic beats 10 raw chunks. Raw chunks preserve the original text unchanged so claims can be verified against the source. The model answers from wiki TLDRs by default and drills into raw chunks only when the user asks for exact wording or challenges a claim.

---

## Module Tree

```
src/lib/server/
  llmwiki/
    config.ts          ← limits (POINTER_CAP, MAX_RAWRAG_TOOL_CALLS_PER_TURN)
    overview.ts        ← load the top-level 'overview' page (~500 tok)
    search.ts          ← hybrid vector+BM25 → LlmwikiHit[]
    queries.ts         ← hydratePointers (JOIN chunks, cap at POINTER_CAP=5)
    wiki-format.ts     ← TOON-encode hits + pointers into system prompt
    verify.ts          ← citation verification (onFinish)
    compile/           ← scaffold: page compilation jobs
    lint/              ← scaffold: lint runner
  rawrag/
    index.ts           ← retrieve(), formatContextForPrompt()
    chunk.ts           ← chunking logic
    embed.ts           ← embedding pipeline
    ingest/            ← ingestion pipeline (contextual-prep, entity-extract)
  ai/tools/
    get-llmwiki-pages.ts   ← expand wiki pages beyond TLDR
    get-rawrag-chunks.ts   ← drill-down to raw source chunks
    index.ts               ← buildRetrievalTools({ userId })
```

---

## Database Tables

**llmwiki tables** (`rag` schema):

| Table | Purpose |
|-------|---------|
| `rag.llmwiki_page` | Page with `title + tldr + body + tags + frontmatter`. Only `title + tldr + tags` are embedded. |
| `rag.llmwiki_page_source` | Junction to `rag.chunk` with `weight`. Maps which raw chunks a page was compiled from. |
| `rag.llmwiki_page_link` | Wikilinks between pages (`[[slug]]`). |
| `rag.llmwiki_page_redirect` | Slug renames — old slug → new slug. |
| `rag.llmwiki_lint_issue` | Lint findings per page (broken links, stale pointers, etc.). |

**rawrag tables** (`rag` schema): `rag.document` (source documents) and `rag.chunk` (pgvector 1536 + BM25 tsvector). See [graph-rag.md](./graph-rag.md) for schema detail.

---

## Tool Contracts

Both tools close over `userId` via `buildRetrievalTools({ userId })`. The model cannot forge `userId`.

### `get_llmwiki_pages`

```typescript
get_llmwiki_pages({ ids: string[], include_body?: boolean })
```

Expands wiki pages (by id or slug) beyond the TLDR already in the system prompt. The model calls this when a topic summary isn't enough but it doesn't yet need raw source text.

### `get_rawrag_chunks`

```typescript
get_rawrag_chunks({ ids: string[] })
```

Fetches raw source chunks by ID. **Drill-down only.** The model calls this when the user asks for exact wording, quotations, specific detail, or challenges a claim.

**The verbatim-IDs rule:** chunk IDs passed to this tool MUST be copied verbatim from a page's `pointers:` list in the `<llmwiki-hits>` block. The model is explicitly forbidden from inventing, guessing, transforming, or abbreviating IDs. This rule was hardened after the model hallucinated `chk_rrf_constant_k` when the pointer was `chk_seed_rrf` — an invented ID silently returns no data, making the fabrication invisible to the user.

A per-turn cap (`MAX_RAWRAG_TOOL_CALLS_PER_TURN = 3`) is enforced by the orchestrator via `stepsForScopes`.

---

## Read Path (Chat Hot Path)

1. **Overview** — `llmwiki/overview.ts` loads the top-level `kind='overview'` page (~500 tok) into the system prompt on every request.
2. **Wiki search** — `llmwiki/search.ts` runs hybrid vector (TLDR + title + tags) + BM25 (body) → top-N `LlmwikiHit[]`.
3. **Pointer hydration** — `llmwiki/queries.ts:hydratePointers` runs a single JOIN, caps pointers per page at `POINTER_CAP=5`, ordered by `weight DESC, chunkId ASC`.
4. **Prompt encoding** — `llmwiki/wiki-format.ts` TOON-encodes hits + pointers into a `<llmwiki-hits>` block in the system prompt. See [toon.md](./toon.md).
5. **Stream** — `streamText` runs with `get_llmwiki_pages` and `get_rawrag_chunks` in the tool set. The model answers from TLDRs by default; calls `get_rawrag_chunks` only for exact wording, quotes, or claim verification.
6. **Citation verification** — `onFinish` calls `llmwiki/verify.ts`, which compares drilled chunk IDs against current `chunk.contentHash` and emits an SSE `citations` frame.

---

## Citation Verification

`verify.ts` runs after the stream closes. It assigns one status per chunk:

| Status | Meaning |
|--------|---------|
| `'quote'` | Hash match + verbatim text present in the response |
| `'paraphrase'` | Hash match, no verbatim text |
| `'drifted'` | Hash mismatch — chunk changed since the page was compiled |
| `'uncited'` | Chunk was in the pointer list but not drilled into |
| `'none'` | Page was not drilled at all |

`'drifted'` is the signal that a wiki page needs recompilation. The lint scheduler monitors drift rate.

---

## Compile and Lint (Scaffold)

`llmwiki/compile/` and `llmwiki/lint/` exist as scaffolding. Job entry points are in `src/lib/server/jobs/`. A seed fixture is at `scripts/seed-llmwiki.ts`. Production rollout is gated on lint being scheduled and green.
