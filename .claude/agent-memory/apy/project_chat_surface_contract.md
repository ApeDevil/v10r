---
name: project-chat-surface-contract
description: Three chat surfaces share POST /api/ai/chat; grounding flags (useLlmwiki/useRetrieval) are client-sent booleans, only rag-chat showcase sets them
metadata:
  type: project
---

Three chat surfaces share one endpoint `POST /api/ai/chat` (orchestrateChat):
1. rag-chat showcase (`src/routes/.../showcases/ai/retrieval/rag-chat/+page.svelte`) — full grounding; its `DefaultChatTransport.body` has reactive getters `get useLlmwiki()` / `get useRetrieval()` gated on `?mode=`.
2. floating Chatbot widget (`src/lib/components/composites/chatbot/Chatbot.svelte`) — sends only `{conversationId}` in sendMessage body. No grounding.
3. desk ChatPanel (`src/lib/components/chat/ChatPanel.svelte`) — sends `{conversationId, panelContext?, toolScopes, providerId?, activeWorkspace?}`. Has desk:* scopes, no grounding.

**Contract shape (`ChatRequestSchema`, src/lib/server/ai/validation.ts):** grounding is driven by CLIENT-sent optional booleans `useRetrieval` (:69), `retrievalTiers` (:70), `fusion` (:71), `useLlmwiki` (:73), `llmwikiCollectionId` (:74). The route (`+server.ts`) passes them straight into orchestrateChat. `locale`/`authCeiling` are SERVER-derived (locals.locale / locals.user.role) and correctly NOT in the schema.

**Orchestrator gate:** `wantsTools = !!toolScopes?.length || !!useLlmwiki || !!useRetrieval` (chat-orchestrator.ts ~:379). Tool turns route to the tool-capable provider (Gemini/OpenAI) because Groq/llama emits textual tool-call leaks. So a client toggling useLlmwiki/useRetrieval can force expensive provider routing + retrieval/embeddings.

**Why this matters:** Display of catalog citation chips is ALREADY wired in both widgets (Chatbot.svelte:260, ChatPanel.svelte:358) — only the triggering flag is missing. Capability (A) catalog links is mostly a client wiring change. Capability (B) docs-nRAG needs a real ingestion pipeline (no `docs` ingestion path exists; documentSourceEnum = upload/web/text/api/catalog, document.ts:13).

**How to apply:** When changing chat grounding behavior, remember it is one endpoint serving three surfaces — diverge per-surface only with documented reason. Consider whether capability should be a server-mapped surface policy rather than a free client boolean. See [[project-ai-budget-not-wired]].
