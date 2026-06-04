---
name: chat-surfaces-grounding
description: Three chat surfaces share /api/ai/chat; only rag-chat showcase sets useLlmwiki/useRetrieval, so only it grounds. Flags are client-controlled today.
metadata:
  type: project
---

`/api/ai/chat` → `orchestrateChat` is the single door for three chat surfaces. The grounding branch (`useLlmwiki` / `useRetrieval`) is gated on **client-sent booleans** in `ChatRequestSchema`.

- **rag-chat showcase** (`showcases/ai/retrieval/rag-chat/+page.svelte`): transport `body` has reactive getters `get useLlmwiki()` / `get useRetrieval()` (mutually exclusive, toggled by `?mode=llmwiki`). The ONLY surface that grounds today.
- **floating Chatbot widget** (`composites/chatbot/Chatbot.svelte`): sends only `{conversationId}`. No grounding. Already renders `catalogSources` chips (just never populated).
- **desk ChatPanel** (`components/chat/ChatPanel.svelte`): sends `toolScopes` (desk:* workspace ops) + `panelContext` + `providerId` + `activeWorkspace`. No grounding flags. Also already renders `catalogSources` chips.

Orchestrator routing facts (chat-orchestrator.ts):
- `wantsTools = !!toolScopes?.length || !!useLlmwiki || !!useRetrieval` → claims the tool-capable model (resolveToolProvider: OpenAI/Google preferred; Groq/llama leaks textual tool calls, caught by tool-leak-guard).
- The `useLlmwiki` branch **returns early** (~:770) attaching ONLY `buildRetrievalTools` output (llmwiki/rawrag/catalog). It does **not** attach `deskTools`. So `useLlmwiki + toolScopes` in the same turn = desk tools are silently dropped; `stopWhen` is hard-coded `stepCountIs(3)` (ignores `stepsForScopes`). Retrieval and desk tools do NOT compose in one turn today.
- The `desk_propose_plan` interception (createProposal + `harness.proposal` metadata) AND per-step tool-call persistence (`saveToolCall`/`saveConversationStep`) live ONLY in the non-retrieval fallthrough branch (~:864+, `onStepFinish`). The llmwiki/retrieval branches have their own `onStepFinish` that does NOT persist tool calls or intercept plans. Merging tool sets must also port this logic.
- **Merge mechanics (verified):** `buildRetrievalTools` does NOT register `resolve_ref` — only `createDeskTools` does (tools/index.ts:98). So a `{...deskTools, ...retrievalTools}` spread does NOT collide on resolve_ref. The real hazard is that BOTH factories call `wrapToolsWithCompaction` internally, so a naive spread double-wraps each tool's execute. Clean fix: expose the RAW (unwrapped) tool sets, merge, then `wrapToolsWithCompaction` once.
- `locale` + `authCeiling` are server-derived in `+server.ts` (`locals.locale` / `locals.user.role`), never client-trusted — correct, keep it that way.
- `checkUserBudget` (budget.ts) exists but has **zero callers** under `src/routes/api/ai/**` — chat route is rate-limit-only. Enabling retrieval on two more surfaces multiplies per-turn cost against an unenforced `AI_DAILY_TOKEN_CAP`.

**Why:** Mapped while scoping the "expand sidebar chatbot with catalog links + docs nRAG" task (2026-06-04).

**How to apply:** To give the widgets catalog links (cap A), set `useLlmwiki: true` in their transport bodies. But for the desk panel this currently *trades away* its desk tools because of the early-return branch — composing retrieval + desk tools needs an orchestrator change (merge `buildRetrievalTools` into `deskTools` and use a single `stepsForScopes`-style budget). See [[rag-corpus-user-scoped]] for why cap B (docs grounding) needs more than a flag.
