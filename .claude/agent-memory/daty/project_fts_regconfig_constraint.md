---
name: fts-regconfig-constraint
description: Neon PG rejects multi-field to_tsvector(regconfig,...) in GENERATED columns (42P17); all existing FTS hardcodes 'english'
metadata:
  type: project
---

Postgres full-text search in v10r: two non-obvious constraints govern any FTS schema work.

1. **Neon rejects multi-field `to_tsvector(regconfig, ...)` in GENERATED STORED columns** with SQLSTATE 42P17 ("generation expression is not immutable"). Single-field `to_tsvector('english', content)` over one column IS allowed (rag.chunk uses `.generatedAlwaysAs(...)`). Multi-field concatenations (title || tldr || body) must be populated by app code on insert/update — see `rag.llmwiki_page.search_vector` which is a plain `tsvector` column written by `llmwiki/compile/`.

2. **Every FTS query in the codebase hardcodes `'english'`** as the regconfig — including `blog.searchPosts()` which runs over de/ru revisions, `rawrag/tiers/contextual.ts`, and `llmwiki/search.ts`. No `german`/`russian`/`simple` regconfig is used anywhere yet. Any multilingual search must introduce a per-row `regconfig` (or per-locale partial tsvector) — there is no precedent to copy.

**Why:** these shape what a multilingual search index can be — you cannot lean on a single generated column with a runtime-chosen language config.
**How to apply:** when designing any tsvector column that mixes fields or needs per-locale stemming, store the `regconfig` as data and populate the tsvector in app code (trigger or write path), not via a generated column.

3. **CONFIRMED (2026-06-01): `blog.revision.search_vector` does NOT exist in the live DB.** Exhaustive check — no `.sql` files in repo; `scripts/db/apply-content-schema-delta.ts` adds only source_path/source_content_hash/translated_by (NOT search_vector); `db:rag-post` setup.ts only does pgvector/HNSW/embedding-model. The schema comment in `revision.ts` ("added via raw SQL migration") describes a migration that was never written. `blog.searchPosts()` (queries.ts:384) is dead code that throws 42703 at runtime, and `createRevision()` (mutations.ts:85) has NO tsvector population path. The blog FTS "precedent" is vaporware — any search work must CREATE the column + GIN index + write path from scratch. The working app-populated precedent to copy is `rag.llmwiki_page.search_vector` (plain tsvector, written by llmwiki/compile).
