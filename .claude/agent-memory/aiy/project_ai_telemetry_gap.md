---
name: ai-telemetry-gap
description: AI telemetry capture state — per-step provider/model now persisted, but cost has no source and embeddings never produce a step row
metadata:
  type: project
---

The earlier telemetry asymmetry (live chat persisted only assistant text + Redis token budget) is RESOLVED as of 2026-06 — verify before re-citing.

**Current state (verified 2026-06-11):**
- `conversation_step` (`src/lib/server/db/schema/ai/conversation.ts:134`) DOES carry `inputTokens`, `outputTokens`, `providerId`, `modelId`, `durationMs`, `retrievalEvents`, `toolCallIds`. Both indexed by `(modelId, createdAt)` and `(providerId, createdAt)`.
- All three orchestrator branches write step rows in `onStepFinish` (llmwiki ~:694, retrieval ~:925, desk ~:1090) after pre-creating the assistant message so the `messageId` FK is valid. Backfill content in `onFinish`.
- The `tryFallback` path is the exception: it still uses `createOnFinish` (assistant text + Redis budget charge only), so fallback turns write NO conversation_step rows → fallback usage is a telemetry blind spot.

**Remaining gaps (still true):**
- NO cost/price dimension anywhere. `conversation_step` stores tokens + model id but no $ cost; cost requires a per-model price table applied to token counts. Cost is derivable, never stored.
- Embedding calls produce NO conversation_step row. They run through `rawrag/embed.ts` on the shared GOOGLE key and are counted ONLY by the coarse Redis `incrEmbeddingCalls` counter (`provider-usage.ts`), which counts a *batch* embedMany call as 1 — undercounts actual embedded items.
- Provider cooldown (`markCooldown`/`isCooledDown`) is now Redis-backed (cross-instance), NOT in-memory as previously noted. User provider *preferences* (`userPreferences` Map in providers.ts:171) ARE still in-memory and reset on restart.

**How to apply:** "usage by model" is live on `/admin/ai/models`. Any *cost* panel is still net-new (needs a price table). Any *embedding cost/volume* accuracy needs per-item counting, not the batch-call counter. Fallback-turn usage won't appear in step-based dashboards until tryFallback adopts onStepFinish. See [[chat-grounding-branches]], [[provider-quota-capture]], [[ai-provider-architecture]].
