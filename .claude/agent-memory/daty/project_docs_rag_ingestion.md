---
name: docs-rag-ingestion
description: Data model for ingesting docs/**/*.md into rag.* — reuse 'catalog' source, soft-pointer to SearchRecord id, no new enum/columns; per-heading chunk anchors
metadata:
  type: project
---

Ingesting the PROJECT'S OWN docs (docs/**/*.md) into the RAG corpus so the sidebar Chatbot + desk ChatPanel can answer "how does X work" grounded in real docs.

**Reuse, do NOT extend the schema.** The rag.* tables already carry every field needed:
- `rag.document` has `source` enum incl. `'catalog'` (= a project surface projected from quick-search), `sourceUri` (carries the stable SearchRecord id), `contentHash`, soft-delete (`deletedAt`), and `document_content_hash_idx`. Ingest docs as `source='catalog'`, `sourceUri='doc:en:${section}/${slug}'` (the EXACT id `src/lib/server/search/adapters/docs.ts:59` mints). This makes the ingested doc the SAME entity the catalog `:Resource` Neo4j node represents (`catalog-projection.ts` uses the same `${surface}:${path}` id scheme) — a SOFT POINTER, not a second source of truth.
- `rag.chunk` already has `parentId` (hierarchy), `level` enum, `position`, `contentHash`, `searchVector` (generated, 'english' only — see [[project-fts-regconfig-constraint]]). For heading anchors, repurpose `contextPrefix` to carry the heading trail OR add a nullable `sourceAnchor` if per-heading citation is required (tier-1 citation today only surfaces `document.title`, no anchor — `rawrag/index.ts:38,249`).

**Why not a new enum value (`docs`)?** documentSourceEnum is `[upload, web, text, api, catalog]`. `'catalog'` is semantically exact: a doc IS a catalog surface. Adding `'docs'` would fork the linkage and orphan the `:Resource` soft-pointer.

**Owner problem (load-bearing).** `searchLlmwiki` and `loadOverview` filter `p.user_id = ${userId}` (`llmwiki/search.ts:72,111`). llmwiki_page and collection.userId are NOT NULL. So a docs collection + its pages need an OWNER. Options: (a) a system/bot user row, (b) make the docs collection global by relaxing the userId filter for a reserved collectionId. The orchestrator passes `llmwikiCollectionId` (default null=global) — a dedicated "project-docs" collection id is the clean scoping handle.

**Idempotent re-ingest:** key on `sourceUri` (the doc's stable id) + `contentHash`. Unchanged hash → skip; changed → re-chunk+re-embed; not-seen-in-manifest → soft-delete (mirrors `catalog-sync.ts` delete-not-seen). Manifest is the source of truth and already applies blocklist/published filtering.

**Container constraint:** `getManifest()`/`getRawMarkdown()` use Vite `import.meta.glob` (`docs/manifest.ts:4`) — NOT runnable from a Bun script. The ingestion script must re-read docs/ via `node:fs` (relative walk) and replicate the manifest's blocklist + section/slug derivation, OR factor the pure derivation out of manifest.ts. Embeddings via google-gemini-embedding-001, 1536-dim (matches seed-llmwiki.ts).
