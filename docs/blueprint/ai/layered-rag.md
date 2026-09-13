# Grounded retrieval

One `retrieve()` kernel, two profiles over two corpora, one ingest-built corpus map. The chatbot answers from the map plus relevance-gated docs and catalog grounding over immutable source chunks; the deskbot answers from the user's own desk files. Nothing between the model and the chunks is LLM-compiled.

> retrieval internals (chunking, embeddings, parent-child, graph traversal): see [graph-rag.md](./graph-rag.md).
> Surface naming (chatbot vs. deskbot) and the one-kernel/two-profile model: see [surfaces.md](./surfaces.md).

---

## One kernel, two profiles

The `retrieval/retrieve()` kernel (embed → tiers → RRF fusion, with the single `user_id` tenant-isolation filter) is **shared mechanism**. Two surfaces exercise it as distinct profiles over distinct corpora — the kernel is never forked (a duplicated `user_id` filter would be a cross-tenant-leak risk), so the corpus boundary is the per-chunk `chunk.user_id` filter (denormalized from `document.userId` at ingest, indexed by `chunk_user_idx`). The owner semantics are unchanged; the mechanism just moved from a document-side JOIN filter to a chunk-side direct filter — so the same `user_id` now lives on both `document` and `chunk` and must stay in sync.

| | chatbot profile | deskbot profile |
|---|---|---|
| Corpus | `SYSTEM_DOCS_USER_ID` docs/catalog — curated (catalog slice graph-seeded; docs-corpus graph tier dormant) | The user's own desk files — private, mutable (`source = 'desk'`) |
| Tiers | **Live: tier-1 only** (the chatbot requests `tiers:[1]`). Tiers 2–3 are designed but unexercised by the chatbot — tier-2 became *eligible* for converted docs after the 2026-06-25 ingest-door change, but the chatbot doesn't request it; tier-3/graph is dormant for the docs corpus | 1–2 (no graph — desk files aren't seeded) |
| Entry | Corpus map (`<project-overview>`) + `search_catalog`/`search_project_docs`/`search_pattern_library` + relevance-gated docs prefetch | `desk_search_knowledge` (`desk:ask`, read-only) |
| Grounding | Post-stream catalog path verification, citation chips | Reference context; no citation chips; read-only |

The deskbot profile lives in `src/lib/server/ai/deskbot-retrieval.ts` (`retrieveDeskDocs`, `syncDeskFileToRetrieval`); the chatbot profile is the read path below plus the relevance-gated prefetch. See [Deskbot Corpus](#deskbot-corpus-source--desk).

---

## Where it lives

| Module | Role |
|-------|------|
| `src/lib/server/retrieval/` | The kernel: chunk → embed → tiers → RRF fusion over immutable source chunks. Ground truth. |
| `src/lib/server/ai/capabilities/` | The chatbot's grounding lanes, one file each: `project-map` (the corpus map), `project-docs` (relevance-gated docs prefetch + `search_project_docs`), `catalog` (`search_catalog`, `<catalog-map>`, the path verifier), `navigation` (`<catalog-results>`), `pattern-library` (`search_pattern_library`). |
| `src/lib/server/ai/tools/` | AI SDK tool wrappers closing over the server-derived `userId`, `locale`, `authCeiling`. |

**Why an ingest-built map?** `db:ingest-docs` writes the map from the doc manifest — deterministic, no LLM, no embedding. It cannot drift from the corpus it was built with, it costs no quota to read, and it lands when the embed quota is exhausted, so a broad question ("how do I use v10r?") always has a floor. Everything below the map is the kernel's chunks, unchanged from source, so claims can be verified against them.

---

## Module Tree

```
src/lib/server/
  retrieval/
    index.ts           ← retrieve(), formatContextForPrompt()
    chunk.ts           ← chunking logic (delegates to markdown-split)
    markdown-split.ts  ← splitMarkdown: heading-aware, fence-safe; dep-free (shared with Bun ingest script)
    embed.ts           ← embedding pipeline (RETRIEVAL_QUERY for queries, RETRIEVAL_DOCUMENT for batches)
    ingest/            ← ingestion pipeline (contextual-prep, entity-extract)
  db/schema/retrieval/
    corpus-map.ts      ← retrieval.corpus_map: one ingest-built map per collection
  docs/overview-body.ts ← buildOverviewBody(): the map's body, Vite-free (shared with the ingest script)
  search/
    catalog-map.ts     ← formatCatalogMap(locale): path-free shape hint for system prompt
    catalog-projection.ts ← deriveCatalogGraph(): pure catalog → Resource nodes + PART_OF edges
  ai/tools/
    search-catalog.ts      ← search_catalog tool: composes quick-search lanes, returns canonical paths
    search-docs.ts         ← search_project_docs tool: semantic retrieval over the ingested docs/ corpus
    search-pattern-library.ts ← search_pattern_library tool: the pattern registry, same CatalogSink
    index.ts               ← the manifest-derived meta maps
  ai/capabilities/         ← one file per capability: which tool mounts, its guidance, its grounding lane
    project-map.ts         ← loadProjectMap(): the corpus map → <project-overview>, cut at PROJECT_MAP_MAX_CHARS
  ai/profile/chatbot.ts    ← CHATBOT_PROFILE, composed per turn by profile.ts composeTurn()
  ai/
    catalog-citations.ts   ← verifyCatalogCitations: exists/drifted/none post-hoc verifier
    tool-leak-guard.ts     ← createToolLeakGuard stream transform + stripTextualToolCall
```

---

## Database Tables

**corpus map** (`retrieval` schema):

| Table | Purpose |
|-------|---------|
| `retrieval.corpus_map` | One ingest-built map per collection: `id`, `user_id` (owner), `collection_id` (NOT NULL, unique), `title`, `body`, `built_at`. Written by `scripts/db/ingest-docs.ts` (`writeProjectMap`, upsert `ON CONFLICT (collection_id)`; body from `buildOverviewBody`). Read by `getCorpusMap(ownerIds, collectionId)` / `countCorpusMaps` (`db/retrieval/queries.ts`); `getRetrievalOverviewStats` reports `totalMaps`. One row today — the project docs map (`map_project_docs`, owner `SYSTEM_DOCS_USER_ID`, collection `PROJECT_DOCS_COLLECTION_ID`). |

**retrieval tables** (`retrieval` schema): `retrieval.document` (source documents) and `retrieval.chunk` (pgvector 1536 + BM25 tsvector). See [graph-rag.md](./graph-rag.md) for schema detail. `document.source` is a `documentSourceEnum` — `'docs'` marks the system-owned project-documentation corpus (see [Docs Corpus](#docs-corpus-search_project_docs) below); `'desk'` marks a user's own desk file in the deskbot corpus (see [Deskbot Corpus](#deskbot-corpus-source--desk)).

---

## Tool Contracts

Every chatbot tool closes over the turn's server-derived values (`userId`, `locale`, `authCeiling`); the model cannot forge them. Contracts: [`search_catalog`](#search_catalog-tool), [`search_project_docs`](#search_project_docs-tool); `search_pattern_library` (`ai/tools/search-pattern-library.ts`) searches the pattern registry and feeds the same `CatalogSink`.

The step budget (`CHATBOT_MAX_STEPS = 3`, `ai/config.ts`) bounds search hops per turn: the last step runs tool-less, so a turn ends in an answer.

---

## Read Path (Chat Hot Path)

The chatbot profile's capabilities run in this order (`ai/profile/chatbot.ts`, composed by `composeTurn` — [profiles.md](./profiles.md)):

1. **Corpus map** — the `project-map` capability calls `loadProjectMap()` (`ai/capabilities/project-map.ts`): one `getCorpusMap([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID)` row read, body cut at `PROJECT_MAP_MAX_CHARS` (2000, `ai/config.ts`), injected as the stable `<project-overview>` block on every turn. No embedding — it lands with the embed quota exhausted. Its trace item is `kind: 'map'`.
2. **Grounding lanes, in parallel, under one embed** — the user message is embedded at most once per turn:
   - **Docs lane (relevance-gated)** — `project-docs`: `shouldGroundFromSystemDocs(text)` skips trivial turns (greetings, acks, `< 12` chars), else fires a tier-1 `retrieve()` over `SYSTEM_DOCS_USER_ID` and injects the hits under `<retrieval-context>`. `search_project_docs` reuses this result as its seed (below). Distinct from the on-demand tool call.

     > **Site-awareness rides this same embed.** When the chatbot resolves the user's current public route ([site-awareness.md](./site-awareness.md)) and the turn is deictic ("how does *this* work?"), the seed reuses *this* prefetch `retrieve()` call — its query is seeded with the server-resolved page title/description instead of firing a second embed, so it costs **zero extra quota**. The resolved page also injects a passive `<current-page>` block alongside `<retrieval-context>`, and the orchestrator emits a deterministic abstention note when the page resolves but no chunks come back. *v1 built (dev, uncommitted).*
   - **Catalog lane** — `navigation`, on a where-question only: `<catalog-results>` from the same search the tool runs, no embedding (see [Navigation grounding](#navigation-grounding-catalog-results)). `<catalog-map>` is injected on every turn.
3. **Stream** — `streamText` runs with `search_catalog`, `search_project_docs` and `search_pattern_library`. The last step the budget allows (`CHATBOT_MAX_STEPS`) runs tool-less (`policy/step-budget.ts`, `answerOnLastStep` via `prepareStep`), so a turn ends in an answer, never on a tool call nothing executes.
4. **Catalog path verification** — after the stream closes, the `catalog` capability's `verify` matches every project path the answer names against the rows this turn surfaced (`<catalog-results>` + the search tools' results) → `trace.citations`: `match: 'path'` (surfaced and named) or `'unsurfaced'` (named, nothing backed it; `known: true` when the catalog has the path). Timed as `finalize.catalogMs`. See [Surface-citation verifier](#surface-citation-verifier).
5. **Persist** — the turn trace is written once ([turn-trace.md](./turn-trace.md)).

---

## Catalog Grounding

The `catalog` capability injects catalog awareness on every chatbot turn so the chatbot can answer "where does X live?" questions and emit verifiable links.

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

**Mounted by the chatbot profile's `catalog` capability only**, never on the desk path.

Meta: `searchCatalogToolMeta = { search_catalog: { risk: 'read', scope: 'desk:read' } }`.

### Navigation grounding (`<catalog-results>`)

A question that asks **where** something lives is answered by a verified path — which the model could otherwise only obtain by spending a tool step (and, with the raw sentence as the query, the AND-matcher often found nothing: "Where is the auth showcase?" answered "not found" after three rounds). So the `navigation` capability searches first. `wantsNavigation(text)` (deterministic, en/de/ru: "where is", "give me the link", "wo ist", "где", …) gates it; `catalogQueryOf(text)` distils the sentence into what the matcher can answer — surface words become the `surface` facet, navigation phrasing and function words are dropped, the rest is the subject (`"Where is the auth showcase? Give me the link."` → `{ query: 'auth', surface: 'showcase' }`). The search is `searchCatalogRecords` — the same function the tool's `execute` calls (ONE DOOR, `tools/search-catalog.ts`) — run as its own grounding lane in parallel with the others (no embedding; the `catalog` source in the trace), capped at `CATALOG_RESULTS_LIMIT` rows. The rows enter the prompt as a dynamic `<catalog-results>` block (`[surface] title — path (breadcrumb)`, paths verbatim) with one rule in the capability's guidance: cite them as written, call `search_catalog` only if none is what was asked. The lane records them in the turn's surfaced-catalog rows, so the citation verifier and the chips treat them exactly like tool output. The probe reports the gate as `catalog_nav`.

### `<catalog-map>` prompt injection

`src/lib/server/search/catalog-map.ts`, `formatCatalogMap(locale)`. A path-free (~120 tok) shape hint injected into the system prompt: per-surface record counts + top breadcrumb group labels. Deliberately path-free — a path-bearing map would let the model answer from the (possibly stale) prompt instead of calling `search_catalog`, bypassing the verifier.

### Surface-citation verifier

`src/lib/server/ai/catalog-citations.ts`, `verifyCatalogCitations(answerText, surfacedPaths, knownPaths)`. Runs after the stream closes (belt-and-suspenders: `strict` schemas govern tool INPUT, not prose).

| Status | Meaning |
|--------|---------|
| `exists` | Path was surfaced this turn — by `search_catalog` or the assembly's `<catalog-results>` — grounded |
| `drifted` | Real catalog path recalled without surfacing — risky recall |
| `none` | Looks like an internal route but not in the catalog — hallucination candidate |

### Citation chips (UI)

`src/lib/components/desk/panels/bot/CitationChip.svelte` + `chat/citation-types.ts`. A native `<a>` to `localizeHref(path) + anchor`, ≥44px touch target, surface badge, EN-fallback badge. The orchestrator builds `metadata.catalogSources` (only rows the answer text references); `ChatMessage.svelte` renders a "Related surfaces" chip row below the answer.

---

## Docs Corpus (`search_project_docs`)

The project's own `docs/` markdown is a retrievable corpus. `search_catalog` answers **where** a surface lives; `search_project_docs` answers **how/why** from the doc bodies — the deep prose the catalog only indexes by title.

### `search_project_docs` tool

`src/lib/server/ai/tools/search-docs.ts`. Mounted by the `project-docs` capability on every tool-bearing chatbot turn. The capability's own prefetch (step 2 above) is handed to the tool as its `seed` (`docsSeed` = the user's question + the `RetrievalResult`); the `<retrieval-context>` framing tells the model the docs were already searched for the question, and a call that asks it anyway is answered from the seed — capped, paths resolved, surfaced — without a second embedding.

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

`SYSTEM_DOCS_USER_ID` and `PROJECT_DOCS_COLLECTION_ID` live in
[`src/lib/server/retrieval/config.ts`](../../../src/lib/server/retrieval/config.ts); their
values are not restated here.

The tool captures `SYSTEM_DOCS_USER_ID` in its closure — the model never supplies it. Ingested rows carry `document.source = 'docs'` (a value in `documentSourceEnum`) with `sourceUri` set to the canonical `/docs` path.

`retrieval.document.userId` is **NOT NULL with `onDelete: cascade`**. System-owned docs use `SYSTEM_DOCS_USER_ID`; user documents carry the real user id. There is no null/orphan ownership state — every document belongs to exactly one owner and is erased with that owner.

---

## Deskbot Corpus (`source = 'desk'`)

The deskbot grounds in the user's **own** desk files (markdown + spreadsheets opted into AI context) — private, mutable, owned by the real user, the mirror image of the system-owned docs corpus.

### `desk_search_knowledge` tool

`src/lib/server/ai/tools/desk-ask.ts`. The deskbot's read-only retrieval grounding tool, gated by the `desk:ask` scope.

```typescript
desk_search_knowledge({ query: string })
```

- Runs `retrieveDeskDocs` (`deskbot-retrieval.ts`) — `retrieve()` over tiers 1–2, hard-filtered to the caller's `userId` (no graph tier; desk files aren't Neo4j-seeded).
- Read-only: emits no `DeskEffect`, never mutates, returns the top 5 chunks as reference context (no citation chips).
- `desk:ask` is **excluded** from `hasMutatingScope` / the desk step budget / the plan gate — it never triggers plan-before-execute.

### Ingestion & freshness

`syncDeskFileToRetrieval(userId, fileId, type)` (`deskbot-retrieval.ts`) (re)ingests one file: deletes any prior copy by `sourceUri` (`desk_file_<id>`), then `ingest({ sourceType: 'desk', userId })`. Empty files are dropped, not ingested.

Freshness is **poll-based, off the hot path** — the `desk-retrieval-sync` job (`jobs/desk-retrieval-sync.ts`) compares `desk.file.updatedAt` to the ingested doc's `updatedAt`, (re)ingests new/changed files, and prunes orphans (origin file deleted or AI-context turned off). Editing a file never pays a per-save embedding round-trip.

---

## Graph Tenancy (Neo4j)

The Neo4j RAG graph is **per-tenant**. A read returns only the caller's own nodes plus the shared system-docs corpus — never another user's.

### Node ownership

| Node | Key | Tenancy |
|------|-----|---------|
| `:Chunk` | id | Carries `ownerId`. |
| `:Entity` | `{name, ownerId}` | Composite — the same entity name under two owners is two distinct nodes. (Was name-only, which merged entities across tenants.) |

`scripts/db/setup-neo4j.ts` enforces this: the old name-only `entity_name_unique` constraint is dropped; `entity_name_owner_unique (name, ownerId)` is the composite uniqueness, with `entity_owner` and `chunk_owner` indexes for the scoped reads.

### Scoped reads

Every RAG graph read in `src/lib/server/graph/retrieval/queries.ts` is scoped `WHERE ownerId IN $ownerIds`. Callers pass `[user.id, SYSTEM_DOCS_USER_ID]` — a user sees their own corpus plus the shared system-docs corpus, nothing else. The three `/api/retrieval/graph*` endpoints are owner-scoped this way (they previously leaked cross-tenant). The chat retrieval path is user-scoped through the same filter.

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

(Or `vr ref`, which chains this after the MCP registry/excerpt-snapshot steps — see
[dev-cli.md](../../stack/ops/dev-cli.md).)

- Hand-rolls its own Neon pool from `process.env.NEON_DATABASE_URL_PROD` (the app's `retrieval` modules import `$lib`/`$env` and can't run under bare Bun), then reads the **saved Google connection** through the alias-free `db/ai/provider-connections.ts` + `ai/connections.ts` leaves, decrypting with `process.env.ENCRYPTION_KEY` — the same reading the app uses. Google disabled, keyless or undecryptable → secret-free message, exit 1, corpus untouched. Reuses the Vite-free `planChunks`.
- Enumerates `docs/**/*.md`, importing the blocklist + canonical-path derivation (`isBlocked`, `parseFrontmatter`, `slugify`, `deriveTitle`) from the Vite-free SSOT `src/lib/server/docs/doc-filter.ts` — the same module the `/docs` manifest imports, so there is no manual sync. Only `RAG_ONLY_BLOCK` (docs rendered in `/docs` but withheld from the chatbot) is ingest-local.
- Idempotent: content-hash skip, soft-delete + re-insert on change, soft-delete-not-seen for removed files.
- Writes the corpus map (`writeProjectMap` → `retrieval.corpus_map`, upsert on `collection_id`) from the manifest — deterministic, no LLM, no embedding.
- As of 2026-06-25 it writes hierarchical chunks (section-parents + paragraph-children) via the shared `planChunks()`, making the docs corpus tier-2-*eligible* — partial today (36/93 docs converted, multi-day quota-gated). The chatbot still reads **tier-1 only**.

> **Free-tier ceilings.** Gemini embeddings cap at ~1000/day (the script paces under ~90/min and backs off on 429). A full corpus re-ingest of all docs can exceed a single day's quota — re-run after the quota resets to finish. Chat **generation** runs on `gemini-2.5-flash` at ~20 calls/day on free tier; once exhausted, grounded chat returns a provider error until reset. Embeddings and chat share the same saved Google connection, so they draw on one provider quota — the admin quota board counts embedding calls separately because `model_call` can't see them ([provider-routing.md](./provider-routing.md)).
