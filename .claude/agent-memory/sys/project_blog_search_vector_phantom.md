---
name: blog-search-vector-phantom
description: blog.revision.search_vector is QUERIED by searchPosts() but has no creation site in repo and is likely absent from the live DB — latent 42703 landmine
metadata:
  type: project
---

`blog.revision.search_vector` is a **phantom column** at runtime. `revision.ts`'s schema comment claims it's a "GENERATED STORED column added via raw SQL migration," but:

- No creation site exists anywhere in repo: not in `scripts/setup-rag.ts` (that creates `rag.chunk`/`rag.llmwiki_page` tsvectors), not in `scripts/db/apply-content-schema-delta.ts` (adds `source_path`/`source_content_hash`/`translated_by` only), not in seed scripts.
- A multi-field generated tsvector would be rejected by Neon anyway (SQLSTATE 42P17 — see [[fts-regconfig-constraint]] in daty's memory).
- `searchPosts()` (`src/lib/server/blog/queries.ts:384`) queries `search_vector @@ plainto_tsquery('english', ...)` but is **called from ZERO routes** — so the missing column has never thrown. The bug is invisible only because blog search is unwired.

**Why:** the moment any `/api/search` wires `searchPosts()` in, the first blog query throws `column "search_vector" does not exist` (Postgres 42703), 500-ing the request unless lanes are isolated.

**How to apply:** before wiring blog into quick-search, (1) bootstrap `blog.revision.search_vector` as a PLAIN app-populated `tsvector` column + GIN index via raw DDL (the `rag.llmwiki_page.search_vector` precedent), populated in the publish transaction with a per-locale `regconfig`; (2) run server search lanes via `Promise.allSettled` so a blog-lane failure degrades to doc+static results instead of nuking the whole search; (3) `searchPosts()` also needs a `post` join with `status='published' AND deleted_at IS NULL` (it joins only `revision` today → drafts/soft-deleted are matchable). Escalate to user to confirm whether the live Neon DB actually has this column.
