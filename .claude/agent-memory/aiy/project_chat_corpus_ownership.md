---
name: chat-corpus-ownership
description: Why project-docs RAG needs a system-owned corpus — every retrieval query/tool is hard-scoped to one userId
metadata:
  type: project
---

All RAG retrieval is user-fenced, which makes a SHARED project-docs corpus a real design decision, not a flag flip.

**Fact:** `buildRetrievalTools(userId, ...)` (`src/lib/server/ai/tools/index.ts:118`) binds a single userId into every tool — `createGetLlmwikiPagesTool(userId)`, `createGetRawragChunksTool(userId)`. rawrag queries filter `AND d.user_id = ${userId}` (queries.ts:39, contextual/parent-child/graph searchers). llmwiki vector+BM25 filter `p.user_id` (search.ts). `IngestableDocument.sourceType` (rawrag/types.ts:44) is `'upload'|'web'|'text'|'api'` — NO `catalog`/`docs`; `documentSourceEnum` (db/schema/rag/document.ts:13) adds `catalog` but not `docs`. `document.userId` is nullable (`onDelete:'set null'`) but a NULL-owner doc is invisible under `= $userId`.

**Why:** the corpus was built for per-user uploaded documents; the only seeded data is `scripts/seed-llmwiki.ts`'s 3-chunk fixture owned by one user.

**How to apply:** For project docs visible to ALL users, the AI-lens preference is a fixed `SYSTEM_DOCS_USER_ID` constant that the orchestrator passes when building the docs retrieval tool (clean closure swap, prompt-cacheable, isolates trusted authored docs from user content) rather than widening every WHERE to `(user_id = $u OR user_id = $sys)` across 6 query sites. Ingest docs under that system user. Docs ingestion script must NOT import `src/lib/server/docs/manifest.ts` — it uses Vite `import.meta.glob` (manifest.ts:4) and crashes under Bun; re-walk via node:fs honoring its BLOCKLIST/BLOCKED_PREFIXES. See [[chat-grounding-branches]].
