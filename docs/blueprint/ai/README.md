# AI Blueprint

Architecture and implementation designs for the AI subsystem.

## Overview

Multi-provider chat assistant with tool calling, Graph RAG retrieval, and desk integration. Uses Vercel AI SDK v6 for a unified API across providers.

| Provider | Capability | Model | Package |
|----------|-----------|-------|---------|
| Groq | Chat | llama-3.3-70b-versatile | `@ai-sdk/groq` |
| OpenAI | Chat | gpt-4o-mini | `@ai-sdk/openai` |
| Google Gemini | Chat + Embeddings | gemini-2.5-flash | `@ai-sdk/google` |

## Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Provider registry | `src/lib/server/ai/providers.ts` | Multi-provider config, cooldowns, user preferences |
| Chat orchestrator | `src/lib/server/ai/chat-orchestrator.ts` | Streaming, fallback rotation, tool calling |
| Error classification | `src/lib/server/ai/errors.ts` | Provider error → user-safe message mapping |
| Tool definitions | `src/lib/server/ai/tools/` | Desk-read, desk-write, retrieval tools |
| rawrag pipeline | `src/lib/server/rawrag/` | Source chunks, embeddings, hybrid/graph retrieval |
| llmwiki layer | `src/lib/server/llmwiki/` | Wiki layer: compile, search, verify |

## Documents

| File | Topics |
|------|--------|
| [layered-rag.md](./layered-rag.md) | **Primary RAG doc.** Two-layer split (llmwiki + rawrag), tables, tool contracts, read path, citation verification |
| [graph-rag.md](./graph-rag.md) | rawrag internals: chunking, embeddings, parent-child, graph traversal, recursive retrieval |
| [desk-integration.md](./desk-integration.md) | AI tool calling for desk operations, I/O log, effect system |
| [toon.md](./toon.md) | TOON format for token-efficient RAG context injection |

## Architecture

```
User → ChatPanel/Chatbot → /api/ai/chat → orchestrateChat()
                                              ├── resolveProvider (user pref → env → first configured)
                                              ├── streamText (with tools if desk scopes)
                                              ├── fallback rotation on rate limit
                                              └── llmwiki-first RAG (overview + search + pointer hydration)
                                                    └── rawrag drill-down (get_rawrag_chunks, on-demand only)
```

Provider resolution: user preference → `AI_PROVIDER` env var → first configured. Circuit breaker with 60s cooldown on rate-limited providers.
