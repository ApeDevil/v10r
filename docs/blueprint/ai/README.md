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

Three per-surface routes (`/api/ai/chatbot`, `/api/ai/deskbot`, `/api/ai/showcase/rag`) replace the former single `/api/ai/chat`; each sets the `surface` discriminant and shares one entry guard. `chat-orchestrator.ts` remains the single dispatcher. See [surfaces.md](./surfaces.md).

| Module | Location | Purpose |
|--------|----------|---------|
| Provider registry | `src/lib/server/ai/providers.ts` | Resolver config (chat/tool/vision), cooldowns, user preferences |
| Image metadata domain | `src/lib/server/imagemeta/` | Framework-free core: ingest, EXIF-strip, vision extract, persist |
| Entry guard | `src/lib/server/ai/guard.ts` | `guardAiRequest`: shared auth → aiConfigured → rate-limit → budget preamble for the per-surface routes |
| Chat orchestrator | `src/lib/server/ai/chat-orchestrator.ts` | Surface dispatch (`TurnSurface`), streaming, fallback rotation, tool calling, catalog grounding |
| Error classification | `src/lib/server/ai/errors.ts` | Provider error → user-safe message mapping |
| Tool definitions | `src/lib/server/ai/tools/` | Split harness: chatbot retrieval (`chatbotToolMeta`, no scope) + deskbot CRUD/action (`deskbotToolMeta`, scoped); `desk:ask` nRAG tool |
| Desk-execute SSOT | `src/lib/server/ai/tools/desk-execute.ts` | `executeDeskToolCall`: one door for desk mutations (in-loop tool + proposal-approval replay), drift-guarded |
| Deskbot nRAG | `src/lib/server/ai/deskbot-rag.ts` | `retrieveDeskDocs` + `syncDeskFileToRag` over the user's own desk files (`source = 'desk'`, tiers 1–2) |
| Catalog citations | `src/lib/server/ai/catalog-citations.ts` | Post-hoc surface-citation verifier (exists/drifted/none) |
| Tool leak guard | `src/lib/server/ai/tool-leak-guard.ts` | Stream transform that suppresses Groq/llama textual tool-call markup |
| rawrag pipeline | `src/lib/server/rawrag/` | Source chunks, embeddings, hybrid/graph retrieval |
| llmwiki layer | `src/lib/server/llmwiki/` | Wiki layer: compile, search, verify |

## Documents

| File | Topics |
|------|--------|
| [surfaces.md](./surfaces.md) | **The naming contract.** chatbot (v10r expert, read-only grounded) vs deskbot (in-desk operator, mutating, plan-gated) vs rag-demo (showcase); explicit `surface`/`TurnSurface` dispatch; per-surface routes (`/api/ai/chatbot` · `/api/ai/deskbot` · `/api/ai/showcase/rag`) + shared `guardAiRequest`; harness split (`chatbotToolMeta`/`deskbotToolMeta`/`allToolMeta`, zero overlap, surface-neutral `ToolMeta`); one-door rule (`executeDeskToolCall` SSOT + drift guard); nRAG = one shared kernel + two profiles/corpora; live-vs-planned status |
| [layered-rag.md](./layered-rag.md) | **Primary RAG doc.** Two-layer split (llmwiki + rawrag); **one shared `retrieve()` kernel, two profiles/corpora** (chatbot system-docs + deskbot user-files); catalog grounding (`search_catalog` incl. browse/enumerate `query:"*"` mode, `<catalog-map>`, citation chips); docs corpus (`search_project_docs`, system-owned, `db:ingest-docs`) + relevance-gated system-docs prefetch (`shouldGroundFromSystemDocs`); deskbot corpus (`source = 'desk'`, `desk_search_knowledge`/`desk:ask` read-only, `deskbot-rag.ts`, `desk-rawrag-sync` freshness); **graph tenancy** (per-tenant `:Chunk`/`:Entity`, owner-scoped reads, `deleteUserGraph` GDPR sweep); tool contracts, read path, citation verification |
| [provider-routing.md](./provider-routing.md) | Chat vs tool resolver split, `wantsTools` logic, Redis circuit breaker (cross-instance), provider quota & limits board (honest-board model, `/api/admin/ai/quota`), Groq drift + leak guard, **UI-message stream frame ordering** (single leading `start` vs duplicate-bubble split), practical consequences |
| [image-metadata.md](./image-metadata.md) | Image Metadata Reader showcase: vision resolver (`resolveVisionProvider`, Groq-excluded), `imagemeta` domain core + import wall, upload→strip→analyze→approve flow, GPS opt-in consent gate + GDPR surface, AI SDK v6 `Output.object` + Valibot re-validation, whole-form atomic approval, `image` pgSchema, reference cost panel (`pricing.ts`, derived-not-stored, thinking-token subset) |
| [image-kit.md](./image-kit.md) | Image Kit toolkit showcase (`/showcases/toolkits/image-kit`): one upload → Run → adjust → Approve flow over three tools (metadata + AI frame-cropper + embedder). **Persists nothing** (ephemeral R2 `showcase/imagekit/` + discard RPC + TTL); auth-gated v1 (userId-derived key, no signed handle). Merged single vision call (metadata + crop hint), **server-authoritative `snapToAspect` geometry** (model gives a hint, never pixels), caption-text (1536) vs multimodal-image (3072) embeddings, deterministic `attention`-crop comparison, ratio-locked corner-handle cropper. Greenfield-additive beside the reader |
| [cost-monitoring.md](./cost-monitoring.md) | Cross-surface admin **Cost** tab (`/admin/ai/cost`): unified Usage-by-Model table merging chat + image telemetry (app-layer `buildUnifiedModelUsage`, never SQL), reference-cost honesty model (derived/partial-coverage/thinking-subset), image health KPIs + save-vs-abandon funnel, Models→Cost relocation, no-$ Overview heartbeat |
| [graph-rag.md](./graph-rag.md) | rawrag internals: chunking, embeddings, parent-child, graph traversal, recursive retrieval; Phase 3 catalog `:Resource` seed |
| [desk-integration.md](./desk-integration.md) | **Superseded v4-era design record** (rationale, not the live contract — see [surfaces.md](./surfaces.md)): AI tool calling for desk operations, I/O log, effect system; deskbot posts `/api/ai/deskbot` |
| [toon.md](./toon.md) | TOON format for token-efficient RAG context injection |
| [harness-lens.md](./harness-lens.md) | "Harness" as an audit *lens* (not a module) over the bot's post-dispatch machinery — tool execution, safety gating, context compaction, state persistence, observability; primitive-ownership map across `ai/loop`, `ai/context`, `ai/policy`, `ai/tools`; surface-split tool metadata (`ToolMeta`/`DeskToolMeta`, `chatbotToolMeta`/`deskbotToolMeta`/`allToolMeta`); one-door `executeDeskToolCall` SSOT + drift guard; now-live `shouldRequirePlan` plan gate |

## Architecture

```
Chatbot.svelte  → POST /api/ai/chatbot      → guardAiRequest → orchestrateChat({surface:'chatbot'})
ChatPanel.svelte → POST /api/ai/deskbot      → guardAiRequest → orchestrateChat({surface:'deskbot'})
rag-chat demo    → POST /api/ai/showcase/rag → guardAiRequest → orchestrateChat (surface derived)
                                                  │  (one orchestrator; surface = explicit dispatch discriminant)
                                                  ├── resolveActiveProvider / resolveToolProvider
                                                  ├── fallback rotation on rate limit (per-surface)
                                                  ├── chatbot: llmwiki-first RAG + relevance-gated system-docs prefetch
                                                  │     ├── rawrag drill-down (get_rawrag_chunks) + resolve_ref
                                                  │     ├── catalog grounding (search_catalog + <catalog-map>)
                                                  │     ├── docs grounding (search_project_docs, system-owned corpus)
                                                  │     └── citation chips (CitationChip.svelte)
                                                  └── deskbot: desk tool loop (scope-gated) + desk:ask nRAG
                                                        └── plan-before-execute (shouldRequirePlan → desk_propose_plan)
```

See [surfaces.md](./surfaces.md) for the chatbot/deskbot naming contract, harness split, and the one-shared-kernel/two-profiles nRAG model.
