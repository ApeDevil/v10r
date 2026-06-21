---
name: ai-conversation-schema
description: Shape of the ai.* conversation tables and the chatbot persistence chokepoints — load-bearing for any citation/grounding/usage schema work
metadata:
  type: project
---

The `ai` pgSchema (`src/lib/server/db/schema/ai/conversation.ts`) holds the chatbot's persistence:
`ai.conversation` (user-scoped, cached totalInput/OutputTokens), `ai.message`
(role enum user|assistant|system|tool, content text, `context` JSONB MessageContext[]),
`ai.tool_call`, `ai.conversation_step` (one row per AI SDK step; inputTokens/outputTokens/
providerId/modelId/durationMs/`retrievalEvents` JSONB/`toolCallIds` JSONB).

**Why this matters:** as of 2026-06-21 NOTHING persists which nRAG chunks grounded a given
assistant message — not IDs, content, verdicts, nor catalog surfaces. Reloading a past
conversation cannot show "view source". A citation feature must add storage.

**CONVERGED design (cross-pollination 2026-06-21):** PHASED, SNAPSHOT not reference.
- v1 = single nullable `citations jsonb` column on `ai.message` holding per-chunk descriptors
  INCLUDING a bounded `contentSnapshot` ("as the model saw it"). Simpler than a new table, NULL on
  the dominant zero-drill case (most answers drill 0 chunks), TOAST-safe if capped (~3 chunks,
  keep array <2KB). Makes historical replay free the day SYS wires loadConversation to read it.
- vN = promote JSONB → normalized `ai.message_citation` table ONLY when admin citation analytics
  (GROUP BY verdict / most-cited-doc) becomes a real ask. No-backward-compat → clean backfill+drop.
- Snapshot WINS over reference-only: `rag.chunk` cascade-deletes from `rag.document` (confirmed
  chunk.ts:22) + the `drifted` verdict exists because content mutates → reference-only renders a
  blank/changed historical modal. Snapshot survives source deletion; store chunk `contentHash`
  separately as drift key (NEVER recompute from snapshot — it's COALESCE(context_prefix||content),
  a different concat than the hash).
- FINAL fields (AIY-corrected): chunkId+documentId (SOFT-ref, NO FK — cascade would erase evidence),
  documentTitle, layer='rawrag', level (sentence|paragraph|section — must add to fetchChunksByIds
  SELECT, defer to AIY), verdict (none|uncited|drifted|paraphrase|quote), provenancePageSlug +
  provenanceWeight, contentSnapshot, contentHash, ordinal. DROP tier/source/score — unknowable for
  fetch-by-ID drilled chunks. vN verdict = new aiSchema.enum('citation_verdict',...) MUST be exported.
- REJECTED: SYS's reuse-toolCall (result is "summarized <500 tokens" per conversation.ts:96 = lossy,
  not the real chunk bodies; llmwiki branch never calls saveToolCall anyway).
- Multi-tenancy: snapshot at write time (fetchChunksByIds/verifyCitations already owner-filter
  d.user_id) → rows born owner-clean → ZERO read-time re-fetch → no cross-user leak surface.

**How to apply:**
- Write path chokepoint = the llmwiki branch `onFinish` in `src/lib/server/ai/chat-orchestrator.ts`
  (~line 728), right after `verifyCitations` — only place where snapshot data AND verdicts coexist.
  The assistant message is PRE-CREATED with a fixed `assistantMsgId` (line ~629) so FKs are valid;
  content is backfilled in onFinish. onFinish can re-fire on retry → make citation writes
  idempotent (delete-by-messageId then insert, in a tx).
- Read path = `getConversation` in `src/lib/server/db/ai/queries.ts` (checks
  `conversation.userId = userId` first → owner gate). Add ONE batched citation query keyed by
  `conversationId` (denormalize conversationId onto the citation row), group by messageId in JS.
- Mutations live in `src/lib/server/db/ai/mutations.ts` (saveConversationStep, saveMessages,
  saveToolCall pattern to mirror). IDs via `createId.*` in `src/lib/server/db/id.ts` (prefix_12hex).
- Two parallel citation streams exist, both ephemeral: rawrag drilled chunks (user-scoped, verdict
  via verifyCitations) AND catalog surfaces (`surfacedCatalog`, PUBLIC project paths, no chunk body).
  Don't conflate — different shapes. See [[rag-chunk-runtime-shapes]].
- db:push: any new pgEnum/pgTable MUST be exported + re-exported from ai/index.ts or push silently
  drops it. Keep enums in aiSchema (not public — public enums get excluded from schemaFilter).
