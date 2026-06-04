---
name: ai-telemetry-gap
description: What AI telemetry is actually persisted vs only schema-defined — the live chat path writes far less than the schema implies
metadata:
  type: project
---

The AI telemetry schema is richer than what the live chat path actually populates. Surfacing per-model usage / cost / tool-success in admin needs NEW capture, not just new queries.

**Fact:** the only persistence funnel in the live chat path is `createOnFinish(conversationId, userId)` in `src/lib/server/ai/chat-orchestrator.ts` (~:122). It does TWO things: `saveMessages(...)` (assistant text only) + `chargeTokens(userId, inputTokens+outputTokens)` (Redis day-bucket, `ai:budget:` key, NOT Postgres). It records NO model/provider, NO per-step rows, NO tool-call rows, NO citation/drift.

The schema `src/lib/server/db/schema/ai/conversation.ts` DEFINES `conversation.totalInput/OutputTokens` (cached cols, default 0, never updated by createOnFinish), `conversation_step` (per-step inputTokens/outputTokens/retrievalEvents/toolCallIds), and `tool_call` (toolName/args/result/status/errorMessage/entityKind/proposalId). These last two tables are effectively UNWRITTEN by chat today. `ai.agent_audit_log` is an explicit scaffold stub (no writer, no query UI, no retention) per its own header.

Admin queries `src/lib/server/db/ai/admin-queries.ts` only `count()` conversation + message rows + group-by-user. They never touch conversation_step or tool_call. So "usage by model", "cost", "tool-call success rate", "citation drift rate", "fallback-rotation rate" have NO source today.

There is also NO `embedding_model` / model dimension on any usage row — `conversation_step` has token cols but no `model`/`provider` column. Cost requires a per-model price table (Groq llama-3.3-70b / OpenAI gpt-4o-mini / Google gemini-2.5-flash) applied to token counts; cost is derived, never stored.

**Why:** telemetry schema was designed up-front for a usage dashboard / historical replay, but the streaming path only wired the two things load-bearing for correctness (persist answer + enforce daily budget). Provider/cooldown state (`markCooldown`/`isCooledDown` in providers.ts) is in-memory only and resets on restart.

**How to apply:** Any admin "AI control room" metric beyond raw conversation/message counts requires capture work FIRST (NO backward-compat — add a `model`/`provider` text col to conversation_step, write step+tool_call rows in onStepFinish, then db:push). Recommend the FEW high-signal metrics and warn the cost/usage-by-model panels are net-new instrumentation, not a query over existing data. See [[chat-grounding-branches]], [[chat-corpus-ownership]].
