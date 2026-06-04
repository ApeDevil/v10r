---
name: chat-grounding-rollout
description: How catalog-links + docs-nRAG grounding gets wired into the sidebar Chatbot and desk ChatPanel; the orchestrator desk-tool composition landmine
metadata:
  type: project
---

Plan to add (A) catalog/llm-wiki links and (B) docs-nRAG to the sidebar Chatbot.svelte + desk ChatPanel.svelte. Both share `POST /api/ai/chat` → `orchestrateChat`.

**Why:** Grounding currently only fires on the rag-chat showcase because only it sets `useLlmwiki`/`useRetrieval` in its transport body. The two widgets render `catalogSources` chips but never trigger them.

**How to apply (verified against chat-orchestrator.ts this session):**
- Cap (A) for the floating Chatbot is a near-flag-flip: add `body: { useLlmwiki: true }` to its `DefaultChatTransport` (Chatbot.svelte:31). conversationId is captured from the `X-Conversation-Id` response header in the fetch wrapper, NOT sent in body — zero collision.
- **LANDMINE:** the `useLlmwiki` branch returns early at chat-orchestrator.ts:770 with ONLY `buildRetrievalTools` and never spreads `deskTools` (deskTools live only in the non-retrieval branch at :890+). Setting `useLlmwiki` on the desk ChatPanel SILENTLY DROPS its desk:* tools + the desk_propose_plan proposal interception. Desk grounding is blocked on an orchestrator tool-set merge, NOT a flag.
- Merge facts: `resolve_ref` is registered ONLY by createDeskTools (tools/index.ts:98); buildRetrievalTools does NOT register it — so merging tool sets does NOT double-register resolve_ref (the round-1 claim was wrong). Both DO call `wrapToolsWithCompaction` — that is the real double-wrap to dedupe.
- Cap (B) is a real pipeline. `IngestableDocument.sourceType` is `'upload'|'web'|'text'|'api'` (rawrag/types.ts:44) — no 'docs'/'catalog'. `ingest()` is NOT idempotent (random doc id, plain insert; rawrag/ingest/index.ts:59-69). `ingest()` and `embed.ts` import `$lib`/`db`/`$env/dynamic/private` so a container Bun script CANNOT import them — must hand-roll like seed-llmwiki.ts.
- Corpus is user-fenced: every retrieval query hard-filters user_id. Docs need a fixed SYSTEM_DOCS_USER_ID owner. See [[rag-corpus-user-scoped]].
- `checkUserBudget` (budget.ts) has ZERO callers under routes/api/ai/** — chat route is rate-limit-only. Wire it before widening grounding.
