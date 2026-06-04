---
name: ai-telemetry-asymmetry
description: AI per-step/per-tool telemetry is persisted ONLY in the desk-tools chat branch, NOT in the llmwiki/retrieval branches; no provider/model/cost column exists anywhere
metadata:
  type: project
---

AI chat telemetry capture is asymmetric across the orchestrator's three branches (`src/lib/server/ai/chat-orchestrator.ts`).

**Persisted today (durable, Postgres `ai` schema):**
- `ai.conversation` (totalInput/OutputTokens cached), `ai.message`, `ai.tool_call` (status/args/result/entityKind), `ai.conversation_step` (per-step inputTokens/outputTokens, retrievalEvents jsonb, toolCallIds).
- BUT `tool_call` + `conversation_step` are written ONLY in the **non-retrieval / desk-tools branch** (`onStepFinish` at lines ~926-1037 calling `saveToolCall`/`saveConversationStep`/`refreshConversationTokens`).
- The `useLlmwiki` and `useRetrieval` branches (the primary RAG/chatbot grounding paths) call ONLY `createOnFinish` → saves the final assistant message + charges Redis budget. They persist NO per-tool row and NO per-step tokens. So `get_rawrag_chunks` / `search_catalog` / `search_docs` / `get_llmwiki_pages` invocations are invisible in `tool_call`.

**Why:** the telemetry was built for the desk agent-harness path; the retrieval branches stream custom pipeline events to the client (ephemeral) instead of writing rows.

**Hard gaps (no column exists, any branch):**
- NO provider/model name persisted anywhere. Model id (`activeInfo?.id`) is only emitted as an ephemeral `pipeline:step` event, never written. → "usage by model" is impossible to query.
- NO cost/pricing. `budget.ts` charges raw token counts to Redis (`ai:budget:{userId}:{day}`, 25h TTL) with NO provider attribution and NO dollar conversion. Historical/durable usage-by-day-by-model does not exist in Postgres.
- llmwiki admin stats have ZERO query coverage: `llmwikiPage`/`llmwikiLintIssue`/`llmwikiPageLink`/`llmwikiPageRedirect` are referenced ONLY by their own schema files — no admin-queries touch them.

**How to apply:** Surfacing "usage by model", "cost", or "tool-call success rate across the chatbot" needs NEW capture: (1) add `model`/`provider` columns to `conversation_step` (or a `model_usage` rollup table), (2) wire `saveToolCall`+`saveConversationStep` into the llmwiki/retrieval `onFinish`/`onStepFinish`. NO backward-compat in this repo → just edit schema + `db:push`. Neo4j graph stats already have `getRagGraphStats()` (Entity nodes, RELATED_TO edges) in `src/lib/server/graph/rag/queries.ts`. Tool-topology panel needs NO DB — `deskToolMeta` registry (`src/lib/server/ai/tools/index.ts`) carries risk+scope statically.

**Verified deltas (2026-06-04, against live schema `src/lib/server/db/schema/ai/conversation.ts`):**
- `conversationStep` cols = id, conversationId, messageId, stepIndex, stepType, inputTokens, outputTokens, `retrievalEvents` jsonb (`{tier,status,chunkCount,durationMs}[]`), toolCallIds, createdAt. NO model/provider, NO durationMs at step level (durationMs is INSIDE retrievalEvents, per-tier, not per-step latency), NO cost.
- `RetrievalEvent` does NOT carry citation status (quote/paraphrase/drifted) — verify.ts verdicts are ephemeral; the two streams don't join. "Citation drift rate" needs either a new field on RetrievalEvent or a verification rollup.
- `saveConversationStep(data)` signature accepts NO `retrievalEvents` param today — extending capture means BOTH a column-less signature change AND populating it. `saveToolCall`/`saveConversationStep` are `await`ed (not fire-and-forget at the mutation level).
- `llmwikiPage.compiledByModel` (notNull text) EXISTS → "pages compiled by model X" queryable now. `stale` partial idx, `llmwiki_link_broken_idx` (to_id IS NULL) partial idx, lint codes+severity+resolvedAt all exist → llmwiki health fully derivable, just no admin-query file.
- `documentSourceEnum` = upload/web/text/api/`catalog`/`docs` → GROUP BY source + `WHERE source='docs'` trivial for nRAG-pipeline node counts.
- One single capture pass unlocks: model column on conversationStep + retrievalEvents param + saveToolCall in llmwiki/retrieval onStepFinish. Cost = derived (tokens × static price config), NEVER stored.
