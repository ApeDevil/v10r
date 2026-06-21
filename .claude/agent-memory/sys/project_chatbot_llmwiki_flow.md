---
name: chatbot-llmwiki-flow
description: Runtime trace of the floating chatbot's useLlmwiki branch — drill chunk capture, message-metadata flush timing, onFinish verify, and the historical-replay persistence gap
metadata:
  type: project
---

Runtime flow of the always-on floating chatbot (`useLlmwiki:true`), as of 2026-06-21 (branch security-hardening). Source: `src/lib/server/ai/chat-orchestrator.ts` (orchestrateChatInner).

**Why:** Feature work to surface drilled rawrag chunk CONTENT to a client modal repeatedly needs this map. The chunk content currently lives only inside the tool execute() return and is discarded after the model reads it.

**How to apply:** Reach for this before re-deriving the flow. Verify line numbers against current file — the orchestrator churns.

Key facts:
- Three mutually-exclusive branches in `orchestrateChatInner`: useLlmwiki (chatbot, ~line 449), useRetrieval (legacy one-shot, ~842), desk/non-retrieval fallback (~960). Early returns → only one runs per turn.
- `get_rawrag_chunks` (`src/lib/server/ai/tools/get-rawrag-chunks.ts`) execute() calls `fetchChunksByIds(ids, userId)` (`rawrag/queries.ts`) → returns `{chunks: RawChunkRow[], missing}` to the MODEL. RawChunkRow = `{chunkId, documentId, documentTitle, content}` — NO tier/source/score (those come from retrieve()/pointers, not the drill).
- The `DrilledChunkSink` (wired in `ai/tools/index.ts:buildRetrievalTools`) records ONLY chunk IDs into `drilledChunks: Set<string>`. Content is dropped after the sink.record(keys) call.
- Transport: `createUIMessageStream` + a `flush()` closure that does `writer.write({type:'message-metadata', messageMetadata: meta})`. meta = `{pipeline}` always + Object.assign of `citationsPayload` + `catalogPayload`. **message-metadata REPLACES (not merges) on the client** — every flush must carry the full accumulated object.
- flush() is called many times: live per pipeline event, and twice more in onFinish (after verifyCitations, after catalog verify). Drill happens mid-stream (onStepFinish); verify + payloads at onFinish (~line 710).
- onFinish runs `verifyCitations({userId, drilledChunkIds, answerText})` → Map(chunkId→quote|paraphrase|drifted|uncited). **CONFIRMED 2026-06-21: verify.ts ALREADY SELECTs `chunkTable.content` into perChunk[id].content** (used only for a .slice(0,80) quote check, then discarded). So full content is already in memory at onFinish for FREE — no separate re-fetch needed; just widen the verify SELECT to also grab `level` (rag.chunk.level enum sentence|paragraph|section, NOT currently selected by verify OR fetchChunksByIds) and surface content+level+verdict together in one consistent owner-scoped read. The drill sink only needs the ID set; content capture rides verify.
- Client: `Chatbot.svelte` (composites/chatbot) uses `Chat` from @ai-sdk/svelte; reads `message.metadata.catalogSources` → `ChatMessage.svelte` → `CitationChip.svelte` ("Related surfaces"). Chunk content never reaches the client today.

**THE HISTORICAL-REPLAY GAP (load-bearing):**
- In the useLlmwiki branch, `onStepFinish` does NOT call `saveToolCall`. It only emits pipeline events + calls `saveConversationStep` (tokens/provider/model/duration). So `get_rawrag_chunks` args/results are NEVER persisted for the chatbot.
- `saveToolCall` IS called only in the desk/non-retrieval branch (~line 1027). The `toolCall` table stores `{args, result}` and the io-log query (`db/ai/io-log-queries.ts`) already reads them — but the chatbot never writes there.
- `getConversation` (`db/ai/queries.ts:49`) does `select()` (all cols) so it ALREADY returns `message.context` (jsonb, typed `MessageContext[]|null`, desk-only). But `ai.message` has NO generic `metadata` column for chatbot citation/pipeline/catalog payloads. `loadConversation` (Chatbot.svelte:92-96) maps messages to `parts:[{type:'text',text:m.content}]` and assigns chat.messages directly — sets NO metadata field, ignores m.context → chips/modal cannot render after reload.
- `saveMessages` (mutations.ts:41-44) takes only `{id,role,content}` — no metadata param. `updateMessageContent` (80-82) updates only content. `saveToolCall` (mutations.ts:93) stores `{args,result}` jsonb where result = exactly what the model saw (the chunk array WITH content) → reusing it gives a free as-cited content snapshot; io-log reader already parses it.
- Therefore: live turn can stream chunk content; reloading a past conversation has zero persisted chunk data. Historical "view source" needs new persistence (hand schema to DATY) — simplest seam is to make the llmwiki branch call `saveToolCall` for get_rawrag_chunks (table + io-log reader already exist).

Ownership: every drill is owner-scoped — `fetchChunksByIds` filters `d.user_id = userId AND deleted_at IS NULL AND status='ready'`; verifyCitations filters the same. Cross-user leak is structurally prevented as long as new read paths reuse these helpers and never trust a client-supplied chunkId without the userId filter.
