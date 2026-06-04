---
name: chat-transport-grounding
description: How Chatbot.svelte and ChatPanel.svelte should set useLlmwiki/useRetrieval in DefaultChatTransport body to enable catalog grounding
metadata:
  type: feedback
---

`useLlmwiki` and `useRetrieval` are CLIENT-controlled optional booleans in `ChatRequestSchema`. They are already validated and forwarded by `/api/ai/chat/+server.ts` to `orchestrateChat`. The ONLY place that sets them today is the rag-chat showcase via a reactive-getter body object on `DefaultChatTransport`.

The floating `Chatbot.svelte` and desk `ChatPanel.svelte` do NOT send these flags — they pass only `conversationId` (Chatbot) or desk scopes + context (ChatPanel). Display of citation chips is already wired in both components; triggering is not.

**Why:** The orchestrator's `wantsTools` gate is `!!toolScopes?.length || !!useLlmwiki || !!useRetrieval`. Without either flag the tool-capable model path is skipped for these widgets, so `search_catalog` never fires even though the backend and display are fully wired.

**How to apply:**

- **Chatbot.svelte**: Add `useLlmwiki: true` as a static value in the `DefaultChatTransport` constructor `body`. Conversational id is per-send (line 132 body arg), not in the static body, so there is no collision. Always-on is correct; no reactive getter needed.

- **ChatPanel.svelte**: Do NOT add `useLlmwiki: true` until the orchestrator merges the two tool branches. The `useLlmwiki` branch in `chat-orchestrator.ts` (line 438) returns early and calls ONLY `buildRetrievalTools` — it does NOT include `deskTools`. Adding `useLlmwiki: true` to ChatPanel while `toolScopes` are present silently drops the desk:* workspace tools (createReadTools, createWriteTools, desk_propose_plan, resolve_ref), and the proposal-interception `onStepFinish` path at line 947 also never runs. The widget would appear to work (it still chats) while its core desk capability is gone.

**Critical orchestrator constraint (verified at chat-orchestrator.ts:438):** `if (useLlmwiki && ...)` → early return with retrieval tools only. `deskTools` are only attached in the non-retrieval path (line 901). These branches do NOT compose today.

**Desk panel catalog grounding requires:** merging tool sets (`{...createDeskTools(...), ...buildRetrievalTools(...).tools}`), deduplicating double-registered `resolve_ref` and double `wrapToolsWithCompaction`, unifying the step budget, and routing the desk `onStepFinish` logic into the merged branch. That is an L-effort orchestrator change before ChatPanel should set any retrieval flag.

**A shared transport factory is not justified** — the two widgets have significantly different body shapes; a factory would add indirection for a two-line change.

See also [[nrag-docs-ingestion]] for capability (B) which requires a full ingestion pipeline, not a flag flip.
