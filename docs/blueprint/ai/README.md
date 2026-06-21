# AI Blueprint

Architecture and implementation designs for the AI subsystem.

## Overview

Multi-provider chat assistant with tool calling, Graph RAG retrieval, catalog grounding, and desk integration, plus a vision capability for image metadata extraction. Uses Vercel AI SDK v6 for a unified API across providers.

### Provider registry

Two separate resolvers handle different jobs:

| Resolver | Purpose | Default order |
|----------|---------|---------------|
| `resolveActiveProvider` | Chat-only turns (no tools) | user pref → `AI_PROVIDER` env → first configured |
| `resolveToolProvider` | Tool-calling turns | user pref → `AI_PROVIDER` env → OpenAI → Google → others |
| `resolveVisionProvider` | Image input (vision) | user pref → `AI_PROVIDER` env → Google → OpenAI (Groq excluded) |

All three providers carry `supportsTools: true`, but Groq/llama probabilistically emits tool calls as plain text rather than a structured `tool_calls` field. The `tool-leak-guard.ts` transform suppresses that markup so the turn degrades to empty instead of leaking syntax. For reliable grounding, the tool provider prefers OpenAI → Google.

| Provider | Model | Notes |
|----------|-------|-------|
| Groq | llama-3.3-70b-versatile | Default chat model; `supportsTools` but can drift; text-only (no vision) |
| OpenAI | gpt-4o-mini | Preferred tool provider; vision-capable |
| Google Gemini | gemini-2.5-flash | Second-choice tool provider; preferred vision provider |

Circuit breaker: 60s cooldown on rate-limited providers (`markCooldown` / `isCooledDown`), Redis-backed so it is cross-instance and async.

## Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Provider registry | `src/lib/server/ai/providers.ts` | Resolver config (chat/tool/vision), cooldowns, user preferences |
| Image metadata domain | `src/lib/server/imagemeta/` | Framework-free core: ingest, EXIF-strip, vision extract, persist |
| Chat orchestrator | `src/lib/server/ai/chat-orchestrator.ts` | Streaming, fallback rotation, tool calling, catalog grounding |
| Error classification | `src/lib/server/ai/errors.ts` | Provider error → user-safe message mapping |
| Tool definitions | `src/lib/server/ai/tools/` | Desk-read, desk-write, retrieval, catalog search |
| Catalog citations | `src/lib/server/ai/catalog-citations.ts` | Post-hoc surface-citation verifier (exists/drifted/none) |
| Tool leak guard | `src/lib/server/ai/tool-leak-guard.ts` | Stream transform that suppresses Groq/llama textual tool-call markup |
| rawrag pipeline | `src/lib/server/rawrag/` | Source chunks, embeddings, hybrid/graph retrieval |
| llmwiki layer | `src/lib/server/llmwiki/` | Wiki layer: compile, search, verify |

## Documents

| File | Topics |
|------|--------|
| [layered-rag.md](./layered-rag.md) | **Primary RAG doc.** Two-layer split (llmwiki + rawrag), catalog grounding (`search_catalog` incl. browse/enumerate `query:"*"` mode, `<catalog-map>`, citation chips), docs corpus (`search_project_docs`, system-owned ownership, `db:ingest-docs`), **graph tenancy** (per-tenant `:Chunk`/`:Entity`, owner-scoped reads, `deleteUserGraph` GDPR sweep), tool contracts, read path, citation verification |
| [provider-routing.md](./provider-routing.md) | Chat vs tool resolver split, `wantsTools` logic, Redis circuit breaker (cross-instance), provider quota & limits board (honest-board model, `/api/admin/ai/quota`), Groq drift + leak guard, **UI-message stream frame ordering** (single leading `start` vs duplicate-bubble split), practical consequences |
| [image-metadata.md](./image-metadata.md) | Image Metadata Reader showcase: vision resolver (`resolveVisionProvider`, Groq-excluded), `imagemeta` domain core + import wall, upload→strip→analyze→approve flow, GPS opt-in consent gate + GDPR surface, AI SDK v6 `Output.object` + Valibot re-validation, whole-form atomic approval, `image` pgSchema, reference cost panel (`pricing.ts`, derived-not-stored, thinking-token subset) |
| [cost-monitoring.md](./cost-monitoring.md) | Cross-surface admin **Cost** tab (`/admin/ai/cost`): unified Usage-by-Model table merging chat + image telemetry (app-layer `buildUnifiedModelUsage`, never SQL), reference-cost honesty model (derived/partial-coverage/thinking-subset), image health KPIs + save-vs-abandon funnel, Models→Cost relocation, no-$ Overview heartbeat |
| [graph-rag.md](./graph-rag.md) | rawrag internals: chunking, embeddings, parent-child, graph traversal, recursive retrieval; Phase 3 catalog `:Resource` seed |
| [desk-integration.md](./desk-integration.md) | AI tool calling for desk operations, I/O log, effect system |
| [toon.md](./toon.md) | TOON format for token-efficient RAG context injection |

## Architecture

```
User → ChatPanel/Chatbot → /api/ai/chat → orchestrateChat()
                                              ├── resolveActiveProvider / resolveToolProvider
                                              │     (wantsTools = desk scopes OR useLlmwiki OR useRetrieval)
                                              ├── streamText (tools always attached for llmwiki/retrieval branches)
                                              ├── fallback rotation on rate limit
                                              ├── llmwiki-first RAG (overview + search + pointer hydration)
                                              │     ├── rawrag drill-down (get_rawrag_chunks, on-demand only)
                                              │     ├── catalog grounding (search_catalog + <catalog-map>)
                                              │     └── docs grounding (search_project_docs over system-owned docs corpus)
                                              │           └── citation chips (CitationChip.svelte)
                                              └── desk tool loop (desk scopes only)
```
