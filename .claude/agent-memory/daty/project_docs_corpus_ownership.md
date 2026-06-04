---
name: docs-corpus-ownership
description: Docs RAG ingestion is gated by an ownership asymmetry — rawrag doc.userId is nullable but llmwiki_page.userId/collection.userId are NOT NULL and hard-filtered; needs a seeded system user
metadata:
  type: project
---

Ingesting `docs/**/*.md` into the RAG corpus is blocked by an ownership/scoping asymmetry, not by table shape. See [[docs-rag-ingestion]].

**Why:** Retrieval is hard-fenced by user_id at every tier:
- rawrag tier-1 (`rawrag/tiers/contextual.ts:45,75`) filters `AND d.user_id = ${userId}`. `rag.document.userId` IS nullable (`onDelete:'set null'`), but a NULL-owner doc is still invisible because the predicate is equality, not `IS NULL OR =`.
- llmwiki (`llmwiki/search.ts:72,111`) filters `AND p.user_id = ${userId}`, and `llmwiki_page.userId` + `collection.userId` are BOTH `.notNull()`. So the tier-2 layer cannot host an unowned docs corpus at all.
- No system/bot user row exists today (grep found none; `seed-llmwiki.ts` defaults to "first user in table").

**How to apply:** Any docs-ingestion plan MUST first decide corpus ownership. Cleanest: seed one fixed system user (e.g. `usr_system_docs`) + one reserved `project-docs` collection owned by it; ingest all doc rows under that id; pass that collectionId/userId from the orchestrator's docs branch (NOT the request user's). The alternative — widening every retrieval WHERE to `(user_id = $u OR user_id = $sys)` across ~6 query sites — is more invasive and leaks scope logic into the query layer. Prefer the fixed-system-owner closure swap.

Also: `rawrag/ingest/index.ts` `ingest()` is NOT idempotent — it mints a random `doc_<uuid>` id and plain-inserts. Re-running creates duplicate documents. The ingest SCRIPT must own the delete-by-sourceUri / content-hash reconcile (mirror `catalog-sync.ts` delete-not-seen); `ingest()` won't dedup for you.
