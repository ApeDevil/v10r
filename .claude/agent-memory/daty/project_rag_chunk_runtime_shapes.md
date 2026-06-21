---
name: rag-chunk-runtime-shapes
description: Mismatches between RankedChunk (runtime), rag.chunk (table), and what get_rawrag_chunks returns — trips up anyone persisting retrieved chunks
metadata:
  type: project
---

Three different chunk shapes that do NOT line up — verify before persisting retrieved chunks:

1. `RankedChunk` (runtime, `src/lib/server/rawrag/types.ts`) =
   `{chunkId, documentId, documentTitle, content, score, source:'vector'|'bm25'|'graph', tier:1|2|3}`.
   **Has NO `level`.** RAG hierarchy level (sentence|paragraph|section) lives ONLY on the
   `rag.chunk` table (`chunkLevelEnum`). To persist level alongside a retrieved chunk you must
   join/select `rag.chunk.level` at write time — RankedChunk won't give it to you.

2. `get_rawrag_chunks` tool (`src/lib/server/ai/tools/get-rawrag-chunks.ts`) →
   `fetchChunksByIds` (`src/lib/server/rawrag/queries.ts`) returns
   `COALESCE(context_prefix || E'\n' || content, content)` — the CONTEXTUALIZED body, not raw
   `chunk.content`. This is what actually grounded the answer (good to snapshot) BUT it will NOT
   byte-match `chunk.content_hash` (hash is over a different concat). Never recompute hash from
   the snapshot; store the chunk's contentHash separately if you want a drift badge.

3. The orchestrator keeps only `drilledChunks` as a `Set<string>` of chunkIds — content/title/
   score/tier are discarded after fetch. To snapshot you must either retain the RawChunkRow map
   or re-fetch (owner-scoped) in onFinish.

**Multi-tenancy:** `fetchChunksByIds(ids, userId)` and `verifyCitations({userId})` both filter
`d.user_id = $userId AND d.deleted_at IS NULL AND d.status='ready'`. Snapshotting at write time
(when these run) makes citation rows born owner-clean → no re-fetch needed on read → eliminates
cross-user leak risk. Any future "compare to current live chunk" feature MUST re-fetch through
the owner-scoped path, never a bare `WHERE id IN`.

**Verdict enum** (`LlmwikiCitationVerification`, `src/lib/server/llmwiki/types.ts`) =
`'none'|'uncited'|'drifted'|'paraphrase'|'quote'`. `rag.chunk` cascade-deletes from `rag.document`
(onDelete cascade) — so a citation table referencing chunkId must use a SOFT ref (no FK), or the
evidentiary snapshot gets destroyed when the source is deleted. See [[ai-conversation-schema]].
