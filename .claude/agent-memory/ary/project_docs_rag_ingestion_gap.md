---
name: docs-rag-ingestion-gap
description: The project's own docs/**/*.md are NOT in the RAG corpus — only a 3-chunk dogfood fixture exists; ingesting docs needs a real script pipeline
metadata:
  type: project
---

The project documentation (`docs/**/*.md`) is NOT in the RAG/llmwiki corpus. The only seed is `scripts/seed-llmwiki.ts` — a tiny hand-written 3-chunk fixture (RRF/HNSW/BM25 primer). There is NO `docs/` ingestion path. `documentSourceEnum = [upload, web, text, api, catalog]` (`db/schema/rag/document.ts`) — no `docs` source value yet.

**Reusable pieces (verified):**
- `rawrag/ingest/index.ts` exports `ingest(doc, onEvent)` — full chunk→contextualize→embed→PG→Neo4j pipeline. Takes `IngestableDocument` with `sourceType`/`sourcePath`. Reuse this; do NOT re-chunk by hand like seed-llmwiki does.
- `rawrag/chunk.ts` already splits markdown at paragraph/section boundaries.
- `llmwiki/compile/index.ts` is a SCAFFOLD (`COMPILE_SCAFFOLD = true`) — the raw-chunks→wiki-pages compiler does NOT exist. llmwiki overview/pages must be written directly (as seed-llmwiki does) until compile lands.

**Hard constraint:** `docs/manifest.ts` reads docs via `import.meta.glob('/docs/**/*.md')` — Vite-only, CANNOT be imported from a Bun script. A docs-ingestion script MUST walk the filesystem itself (`node:fs`/`Bun.Glob`), like `scripts/seed-llmwiki.ts` and `scripts/db/catalog-sync.ts` reimplement their own readers with relative imports.

**Canonical homes:** script → `scripts/db/ingest-docs.ts` wired as `db:ingest-docs` in package.json (sibling to `db:catalog-sync`, `db:seed:llmwiki`). Pure markdown→IngestableDocument reader → a server lib module reusable by both script and an admin route. See [[chat-grounding-wiring]].

**Corpus-identity decision (task-force round 2, daty lens, verified):** ingest docs WITHOUT adding a `docs` enum value. The catalog already mints a stable doc id `doc:en:${section}/${slug}` with `surface:'doc'`, `path:/docs/${section}/${slug}` (`search/adapters/docs.ts:59`). Ingest each doc as `source:'catalog'` with `sourceUri` = that same id, so the rag.document row IS the same entity as its Neo4j `:Resource` catalog node — one soft-pointer, no second source of truth, no enum fork. This is the spatially-cleanest choice: it keeps a single canonical home per doc concept.

**Desk-panel composition (sys lens, verified at orchestrator:438):** the `useLlmwiki` branch builds `tools: retrievalTools` from `buildRetrievalTools()` and does NOT spread `deskTools` — it returns its own `createUIMessageStream` with `stopWhen: stepCountIs(3)`. So `useLlmwiki + toolScopes` in ONE desk turn CONTEND (retrieval wins, desk:* silently dropped), they do not compose. Enabling grounding on ChatPanel therefore requires an orchestrator merge (dedupe double-registered `resolve_ref` + double compaction wrap), not just a client flag. This is the one server change capability (A) needs for the desk surface specifically.
