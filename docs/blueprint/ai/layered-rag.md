# Layered RAG

Two-layer retrieval: `llmwiki` is the primary answer surface; `rawrag` is the audit and drill-down trail.

> rawrag internals (chunking, embeddings, parent-child, graph traversal): see [graph-rag.md](./graph-rag.md).
> Surface naming (chatbot vs. deskbot) and the one-kernel/two-profile model: see [surfaces.md](./surfaces.md).

---

## One kernel, two profiles

The `rawrag/retrieve()` kernel (embed → tiers → RRF fusion → drill, with the single `user_id` tenant-isolation filter) is **shared mechanism**. Two surfaces exercise it as distinct profiles over distinct corpora — the kernel is never forked (a duplicated `user_id` filter would be a cross-tenant-leak risk), so the corpus boundary is the per-chunk `chunk.user_id` filter (denormalized from `document.userId` at ingest, indexed by `chunk_user_idx`). The owner semantics are unchanged; the mechanism just moved from a document-side JOIN filter to a chunk-side direct filter — so the same `user_id` now lives on both `document` and `chunk` and must stay in sync.

| | chatbot profile | deskbot profile |
|---|---|---|
| Corpus | `SYSTEM_DOCS_USER_ID` docs/catalog + per-user llmwiki — curated (catalog slice graph-seeded; docs-corpus graph tier dormant) | The user's own desk files — private, mutable (`source = 'desk'`) |
| Tiers | **Live: tier-1 only** (the chatbot requests `tiers:[1]`). Tiers 2–3 are designed but unexercised by the chatbot — tier-2 became *eligible* for converted docs after the 2026-06-25 ingest-door change, but the chatbot doesn't request it; tier-3/graph is dormant for the docs corpus | 1–2 (no graph — desk files aren't seeded) |
| Entry | llmwiki + `search_catalog`/`search_project_docs` + relevance-gated system-docs prefetch + on-demand drill | `desk_search_knowledge` (`desk:ask`, read-only) |
| Grounding | Post-stream citation verification, citation chips | Reference context; no citation chips; read-only |

The deskbot profile lives in `src/lib/server/ai/deskbot-rag.ts` (`retrieveDeskDocs`, `syncDeskFileToRag`); the chatbot profile is the read path below plus the relevance-gated prefetch. See [Deskbot Corpus](#deskbot-corpus-source--desk).

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
    wiki-format.ts     ← format hits + pointers in a compact TOON-ish layout (no external TOON dep)
    verify.ts          ← citation verification (onFinish)
    compile/           ← scaffold: page compilation jobs
    lint/              ← scaffold: lint runner
  rawrag/
    index.ts           ← retrieve(), formatContextForPrompt()
    chunk.ts           ← chunking logic (delegates to markdown-split)
    markdown-split.ts  ← splitMarkdown: heading-aware, fence-safe; dep-free (shared with Bun ingest script)
    embed.ts           ← embedding pipeline (RETRIEVAL_QUERY for queries, RETRIEVAL_DOCUMENT for batches)
    ingest/            ← ingestion pipeline (contextual-prep, entity-extract)
  search/
    catalog-map.ts     ← formatCatalogMap(locale): path-free shape hint for system prompt
    catalog-projection.ts ← deriveCatalogGraph(): pure catalog → Resource nodes + PART_OF edges
  ai/tools/
    get-llmwiki-pages.ts   ← expand wiki pages beyond TLDR
    get-rawrag-chunks.ts   ← drill-down to raw source chunks
    search-catalog.ts      ← search_catalog tool: composes quick-search lanes, returns canonical paths
    search-docs.ts         ← search_project_docs tool: semantic retrieval over the ingested docs/ corpus
    index.ts               ← buildRetrievalTools(userId, locale, authCeiling)
  ai/
    catalog-citations.ts   ← verifyCatalogCitations: exists/drifted/none post-hoc verifier
    tool-leak-guard.ts     ← createToolLeakGuard stream transform + stripTextualToolCall
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

**rawrag tables** (`rag` schema): `rag.document` (source documents) and `rag.chunk` (pgvector 1536 + BM25 tsvector). See [graph-rag.md](./graph-rag.md) for schema detail. `document.source` is a `documentSourceEnum` — `'docs'` marks the system-owned project-documentation corpus (see [Docs Corpus](#docs-corpus-search_project_docs) below); `'desk'` marks a user's own desk file in the deskbot corpus (see [Deskbot Corpus](#deskbot-corpus-source--desk)).

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

0. **System-docs prefetch (relevance-gated)** — on the chatbot surface, `shouldGroundFromSystemDocs(text)` (`chat-orchestrator.ts`) skips trivial turns (greetings, acks, `< 12` chars), else fires a parallel tier-1 `retrieve()` over `SYSTEM_DOCS_USER_ID` and injects the hits under `<retrieval-context>`. This closes the "fresh user with an empty llmwiki gets zero project knowledge" gap without taxing chit-chat. Distinct from the on-demand `search_project_docs` tool below.

   > **Site-awareness rides this same embed.** When the chatbot resolves the user's current public route ([site-awareness.md](./site-awareness.md)) and the turn is deictic ("how does *this* work?"), the seed reuses *this* prefetch `retrieve()` call — its query is seeded with the server-resolved page title/description instead of firing a second embed, so it costs **zero extra quota**. The resolved page also injects a passive `<current-page>` block alongside `<retrieval-context>`, and the orchestrator emits a deterministic abstention note when the page resolves but no chunks come back. *v1 built (dev, uncommitted).*
1. **Overview** — `llmwiki/overview.ts` loads the top-level `kind='overview'` page (~500 tok) into the system prompt on every request.
2. **Wiki search** — `llmwiki/search.ts` runs hybrid vector (TLDR + title + tags) + BM25 (body) → top-N `LlmwikiHit[]`.
3. **Pointer hydration** — `llmwiki/queries.ts:hydratePointers` runs a single JOIN, caps pointers per page at `POINTER_CAP=5`, ordered by `weight DESC, chunkId ASC`.
4. **Prompt encoding** — `llmwiki/wiki-format.ts` (`formatLlmwikiContext`) formats hits + pointers in a compact TOON-ish layout (no external TOON dependency) into a `<llmwiki-hits>` block in the system prompt. See [toon.md](./toon.md).
5. **Stream** — `streamText` runs with `get_llmwiki_pages` and `get_rawrag_chunks` in the tool set. The model answers from TLDRs by default; calls `get_rawrag_chunks` only for exact wording, quotes, or claim verification.
6. **Citation verification** — `onFinish` calls `llmwiki/verify.ts`, which compares drilled chunk IDs against current `chunk.contentHash` and emits an SSE `citations` frame.

---

## Catalog Grounding

The `useLlmwiki` branch also injects catalog awareness so the chatbot can answer "where does X live?" questions and emit verifiable links.

### `search_catalog` tool

`src/lib/server/ai/tools/search-catalog.ts`. Composes the SAME in-process search API the ⌘K palette uses — no separate index, no drift.

- **Static lane** (`buildSearchIndex(locale)` + `match()`): page / showcase / section / doc titles.
- **Server lane** (`searchContent`): doc bodies + live blog Postgres FTS. Skipped for `surface=page|showcase|section`.
- **Dedup**: server hit wins (richer snippet), keyed by `surface:path:anchor`.
- **Browse / enumerate** (see below): bypasses both lanes for list-all queries.
- **Returns** exact canonical paths the model may cite. Never throws — returns `{results:[], error}` on failure.

#### Browse / enumerate mode

Both lanes do keyword/substring matching, so an enumerate query like `query:"*"` (which the model naturally reaches for to answer "what showcases / pages / docs exist?") matched nothing → empty results → the bot wrongly said "no showcases".

When the trimmed query is empty or a list-all token (`*`, `all`, `_`, `list`, `everything`, `.*`, `%`), the tool enters **browse intent**: it bypasses `match()` and the FTS lane and returns `buildSearchIndex(locale)` filtered by scope (`authCeiling`) + optional `surface`. The tool description tells the model it may pass `query:"*"` (plus an optional `surface`) to enumerate.

> **Cap:** browse is capped at `BROWSE_LIMIT = 8`, so surfaces with more than 8 entries are truncated.

Input schema:

```typescript
search_catalog({ query: string, surface?: 'page'|'showcase'|'section'|'doc'|'blog', limit?: 1–8 })
```

`surface` is a plain scalar enum (NOT nullable/array type) — Groq's constrained decoder rejects `['string','null']` union types.

`locale` and `authCeiling` are server-derived from `event.locals` and captured in the closure. The model cannot forge them. `authCeiling` gates `authScope`; all records are `public` today. A `CatalogSink` side-channel records the surfaced rows for citation chips and the verifier.

**Wired only into the `useLlmwiki` branch** (via `buildRetrievalTools`), not the plain/desk path.

Meta: `searchCatalogToolMeta = { search_catalog: { risk: 'read', scope: 'desk:read' } }`.

### `<catalog-map>` prompt injection

`src/lib/server/search/catalog-map.ts`, `formatCatalogMap(locale)`. A path-free (~120 tok) shape hint injected into the system prompt: per-surface record counts + top breadcrumb group labels. Deliberately path-free — a path-bearing map would let the model answer from the (possibly stale) prompt instead of calling `search_catalog`, bypassing the verifier.

### Surface-citation verifier

`src/lib/server/ai/catalog-citations.ts`, `verifyCatalogCitations(answerText, surfacedPaths, knownPaths)`. Runs after the stream closes (belt-and-suspenders: `strict` schemas govern tool INPUT, not prose).

| Status | Meaning |
|--------|---------|
| `exists` | Path was surfaced by `search_catalog` this turn — grounded |
| `drifted` | Real catalog path recalled without surfacing — risky recall |
| `none` | Looks like an internal route but not in the catalog — hallucination candidate |

### Citation chips (UI)

`src/lib/components/chat/CitationChip.svelte` + `chat/citation-types.ts`. A native `<a>` to `localizeHref(path) + anchor`, ≥44px touch target, surface badge, EN-fallback badge. The orchestrator builds `metadata.catalogSources` (only rows the answer text references); `ChatMessage.svelte` renders a "Related surfaces" chip row below the answer.

---

## Docs Corpus (`search_project_docs`)

The project's own `docs/` markdown is a retrievable corpus. `search_catalog` answers **where** a surface lives; `search_project_docs` answers **how/why** from the doc bodies — the deep prose the catalog only indexes by title.

### `search_project_docs` tool

`src/lib/server/ai/tools/search-docs.ts`. Mounted by `buildRetrievalTools` alongside `search_catalog`, so it's auto-available whenever the `useLlmwiki` branch runs (always-on for the chatbot).

```typescript
search_project_docs({ query: string, limit?: 1–8 })
```

- Runs tier-1 `retrieve()` (semantic + lexical) over the system-owned docs corpus.
- Resolves each chunk's parent `document.sourceUri` → the canonical `/docs/${section}/${slug}` path.
- Feeds the **same** `CatalogSink` as `search_catalog`, so cited doc paths render as `CitationChip`s and pass the surface verifier.
- Returns `{ results: [] }` (not an error) when the corpus is empty.

Meta: `searchDocsToolMeta = { search_project_docs: { risk: 'read', scope: 'desk:read' } }`.

### Ownership (system-scoped corpus)

Every RAG retrieval query hard-filters by owner. The docs corpus is therefore owned by a reserved system user so the orchestrator can query it on any user's behalf without leaking per-user documents.

| Constant (`$lib/server/config.ts`) | Value |
|------------------------------------|-------|
| `SYSTEM_DOCS_USER_ID` | `'system-docs'` |
| `PROJECT_DOCS_COLLECTION_ID` | `'project-docs'` |

The tool captures `SYSTEM_DOCS_USER_ID` in its closure — the model never supplies it. Ingested rows carry `document.source = 'docs'` (a value in `documentSourceEnum`) with `sourceUri` set to the canonical `/docs` path.

`rag.document.userId` is **NOT NULL with `onDelete: cascade`**. System-owned docs use `SYSTEM_DOCS_USER_ID`; user documents carry the real user id. There is no null/orphan ownership state — every document belongs to exactly one owner and is erased with that owner.

---

## Deskbot Corpus (`source = 'desk'`)

The deskbot grounds in the user's **own** desk files (markdown + spreadsheets opted into AI context) — private, mutable, owned by the real user, the mirror image of the system-owned docs corpus.

### `desk_search_knowledge` tool

`src/lib/server/ai/tools/desk-ask.ts`. The deskbot's read-only nRAG grounding tool, gated by the `desk:ask` scope.

```typescript
desk_search_knowledge({ query: string })
```

- Runs `retrieveDeskDocs` (`deskbot-rag.ts`) — `retrieve()` over tiers 1–2, hard-filtered to the caller's `userId` (no graph tier; desk files aren't Neo4j-seeded).
- Read-only: emits no `DeskEffect`, never mutates, returns the top 5 chunks as reference context (no citation chips).
- `desk:ask` is **excluded** from `hasMutatingScope` / `stepsForScopes` / the plan gate — it never triggers plan-before-execute.

### Ingestion & freshness

`syncDeskFileToRag(userId, fileId, type)` (`deskbot-rag.ts`) (re)ingests one file: deletes any prior copy by `sourceUri` (`desk_file_<id>`), then `ingest({ sourceType: 'desk', userId })`. Empty files are dropped, not ingested.

Freshness is **poll-based, off the hot path** — the `desk-rawrag-sync` job (`jobs/desk-rawrag-sync.ts`) compares `desk.file.updatedAt` to the ingested doc's `updatedAt`, (re)ingests new/changed files, and prunes orphans (origin file deleted or AI-context turned off). Editing a file never pays a per-save embedding round-trip.

---

## Graph Tenancy (Neo4j)

The Neo4j RAG graph is **per-tenant**. A read returns only the caller's own nodes plus the shared system-docs corpus — never another user's.

### Node ownership

| Node | Key | Tenancy |
|------|-----|---------|
| `:Chunk` | id | Carries `ownerId`. |
| `:Entity` | `{name, ownerId}` | Composite — the same entity name under two owners is two distinct nodes. (Was name-only, which merged entities across tenants.) |

`scripts/setup-neo4j.ts` enforces this: the old name-only `entity_name_unique` constraint is dropped; `entity_name_owner_unique (name, ownerId)` is the composite uniqueness, with `entity_owner` and `chunk_owner` indexes for the scoped reads.

### Scoped reads

Every RAG graph read in `src/lib/server/graph/rag/queries.ts` is scoped `WHERE ownerId IN $ownerIds`. Callers pass `[user.id, SYSTEM_DOCS_USER_ID]` — a user sees their own corpus plus the shared system-docs corpus, nothing else. The three `/api/retrieval/graph*` endpoints are owner-scoped this way (they previously leaked cross-tenant). The chat retrieval path is user-scoped through the same filter.

### Erasure (GDPR)

| Function (`graph/rag/mutations.ts`) | Scope |
|-------------------------------------|-------|
| `deleteDocumentGraph(documentId, ownerId)` | One document's nodes, owner-scoped. |
| `deleteUserGraph(ownerId)` | All of a user's nodes. |

User deletion (`$lib/server/privacy` `deleteUserData`) sweeps the user's Neo4j nodes via `deleteUserGraph`. The Postgres CASCADE erases relational rows; Neo4j has no foreign keys, so this sweep is the graph-side erasure. See [../../stack/capabilities/gdpr.md](../../stack/capabilities/gdpr.md).

### Ingestion (`db:ingest-docs`)

`scripts/db/ingest-docs.ts`. A **manual**, standalone Bun script — **not** chained into `db:setup`. Run it after editing docs to refresh the corpus:

```bash
podman exec v10r bun run db:ingest-docs
```

- Hand-rolls its own Neon pool + Gemini embedder from `process.env` (the app's `rawrag` modules import `$lib`/`$env` and can't run under bare Bun). Reuses only the Vite-free `splitMarkdown`.
- Enumerates `docs/**/*.md`, importing the blocklist + canonical-path derivation (`isBlocked`, `parseFrontmatter`, `slugify`, `deriveTitle`) from the Vite-free SSOT `src/lib/server/docs/doc-filter.ts` — the same module the `/docs` manifest imports, so there is no manual sync. Only `RAG_ONLY_BLOCK` (docs rendered in `/docs` but withheld from the chatbot) is ingest-local.
- Idempotent: content-hash skip, soft-delete + re-insert on change, soft-delete-not-seen for removed files.
- As of 2026-06-25 it writes hierarchical chunks (section-parents + paragraph-children) via the shared `planChunks()`, making the docs corpus tier-2-*eligible* — partial today (36/93 docs converted, multi-day quota-gated). The chatbot still reads **tier-1 only**. Separately, the llmwiki tier-2 *compiler* (auto-generated wiki pages) remains deferred — a different thing from the parent-child chunks.

> **Free-tier ceilings.** Gemini embeddings cap at ~1000/day (the script paces under ~90/min and backs off on 429). A full corpus re-ingest of all docs can exceed a single day's quota — re-run after the quota resets to finish. Chat **generation** runs on `gemini-2.5-flash` at ~20 calls/day on free tier; once exhausted, grounded chat returns a provider error until reset. Embeddings and chat share the same `GOOGLE_GENERATIVE_AI_API_KEY`, so they draw on one provider quota — the admin quota board counts embedding calls separately because `conversation_step` can't see them ([provider-routing.md](./provider-routing.md)).

---



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
