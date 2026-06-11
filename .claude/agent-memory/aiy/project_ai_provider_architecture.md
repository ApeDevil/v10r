---
name: ai-provider-architecture
description: The dual-resolver provider model — default CHAT is Groq llama-3.3-70b, not Gemini; Gemini is only a tool-provider fallback + the embedding key
metadata:
  type: project
---

Correcting a common misconception: the chat model is NOT gemini-2.5-flash by default.

**Fact (verified `src/lib/server/ai/providers.ts:19-51`, 2026-06-11):** there are two resolvers:
- `resolveActiveProvider` (chat-only, no tools): user pref → `AI_PROVIDER` env → first configured. With only `GROQ_API_KEY` set, this is **Groq llama-3.3-70b-versatile**.
- `resolveToolProvider` (tool-calling turns): user pref → `AI_PROVIDER` env → **OpenAI gpt-4o-mini → Google gemini-2.5-flash → first tool-capable**. Groq is `supportsTools: true` but llama probabilistically emits tool calls as plain TEXT (`<function=...>`) which the `tool-leak-guard.ts` transform suppresses.

So gemini-2.5-flash only drives a turn when it's the *selected tool provider* (e.g. Google preferred and OpenAI cooled/unconfigured). The "20 req/DAY free tier → 503" concern applies to Gemini-as-tool-provider AND to embeddings, which share the SAME `GOOGLE_GENERATIVE_AI_API_KEY` (`rawrag/embed.ts:9`). Embedding model = `gemini-embedding-001` @ 1536 dims (`config.ts:51`).

**How to apply:** When reasoning about quota exhaustion, separate the three Google consumers on one key: tool-provider generation, query embeddings (every llmwiki/retrieval turn), and ingest embeddings (`db:ingest-docs`). Exhausting the Google key degrades retrieval (embeddings) even when the active CHAT provider is Groq. The embedding key has no fallback — if Google is down, ALL semantic retrieval (llmwiki vectorHits + rawrag tier-1) fails and silently degrades to BM25-only (llmwiki) or no-context (rawrag). See [[provider-quota-capture]], [[ai-telemetry-gap]].
