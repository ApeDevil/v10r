---
name: chat-grounding-branches
description: How the three chat surfaces share /api/ai/chat and why useLlmwiki + desk tools contend in one turn
metadata:
  type: project
---

The chat orchestrator (`src/lib/server/ai/chat-orchestrator.ts`) has three mutually-exclusive code paths gated on client-sent flags, and the llmwiki/retrieval branches DROP desk tools.

**Fact:** `wantsTools = !!toolScopes?.length || !!useLlmwiki || !!useRetrieval` (~:379) only claims the tool-capable provider. The `deskTools` const (~:386) is attached ONLY in the non-retrieval branch (~:901). The `useLlmwiki` branch builds `buildRetrievalTools(userId, locale, authCeiling)` and returns early (~:770) with `stopWhen: stepCountIs(3)` hard-coded — desk:* tools and the `desk_propose_plan`/proposal-interception `onStepFinish` are never wired in that branch.

**Why:** retrieval and desk-ops were built as separate surfaces (rag-chat showcase vs desk ChatPanel). No surface ever sent both flags, so the contention was latent.

**How to apply:** Never tell ChatPanel to send `useLlmwiki`/`useDocs` as-is — it would silently trade away its workspace tools. To compose them, the branches must merge tool sets (`{...createDeskTools(...), ...buildRetrievalTools(...).tools}`), dedupe the double-registered `resolve_ref` and double compaction wrap, and unify the step budget. Until merged, keep desk grounding OFF or build a dedicated composed branch. See [[chat-corpus-ownership]].
