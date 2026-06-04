---
name: chat-grounding-wiring
description: Why RAG/catalog grounding only works on the rag-chat showcase and not the floating Chatbot/desk ChatPanel — the transport-body wiring gap
metadata:
  type: project
---

Three chat surfaces share `POST /api/ai/chat` (`orchestrateChat`): the rag-chat showcase (`src/routes/.../showcases/ai/retrieval/rag-chat/+page.svelte`), the floating widget (`src/lib/components/composites/chatbot/Chatbot.svelte`), and the desk panel (`src/lib/components/chat/ChatPanel.svelte`).

`useLlmwiki` / `useRetrieval` are CLIENT-controlled optional booleans in `ChatRequestSchema` (`src/lib/server/ai/validation.ts`). Only the rag-chat showcase sets them, via `DefaultChatTransport({ body: { get useLlmwiki(){...}, get useRetrieval(){...} } })`. The other two widgets send only `{conversationId}` (Chatbot) or desk scopes (ChatPanel), so the orchestrator's retrieval/llmwiki branch never fires for them.

**Why:** capability (A) "catalog links in the sidebar bot" is largely a CLIENT wiring change — both widgets already RENDER `catalogSources` citation chips (Chatbot.svelte ~:260, ChatPanel.svelte ~:358); only the trigger flag is missing.

**How to apply:** the three transport constructors are a DRY candidate — extract a shared `buildChatTransport()` helper. Canonical home would be a client module next to the shared chat sub-components (`$lib/components/chat/` or `composites/chatbot/`), NOT in `$lib/server`. `locale`/`authCeiling` stay server-derived in `+server.ts` (`locals.locale` / `locals.user.role`) — never add to the client schema. See [[docs-rag-ingestion-gap]].
