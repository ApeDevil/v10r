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

Two per-surface routes (`/api/ai/chatbot`, `/api/ai/deskbot`) replace the former single `/api/ai/chat`; each sets the `surface` discriminant explicitly and shares one entry guard. `chat-orchestrator.ts` remains the single dispatcher. See [surfaces.md](./surfaces.md).

| Module | Location | Purpose |
|--------|----------|---------|
| Provider registry | `src/lib/server/ai/providers.ts` | Resolver config (chat/tool/vision), cooldowns, user preferences |
| Image metadata domain | `src/lib/server/imagemeta/` | Framework-free core: ingest, EXIF-strip, vision extract, persist |
| Entry guard | `src/lib/server/ai/guard.ts` | `guardAiRequest`: shared auth → aiConfigured → rate-limit → budget preamble for the per-surface routes |
| Chat orchestrator | `src/lib/server/ai/chat-orchestrator.ts` | Surface dispatch (`TurnSurface`), streaming, fallback rotation, tool calling, catalog grounding |
| Error classification | `src/lib/server/ai/errors.ts` | Provider error → user-safe message mapping |
| Tool definitions | `src/lib/server/ai/tools/` | Split harness: chatbot retrieval (`chatbotToolMeta`, no scope) + deskbot CRUD/action (`deskbotToolMeta`, scoped); `desk:ask` nRAG tool |
| Desk-execute SSOT | `src/lib/server/ai/tools/desk-execute.ts` | `executeDeskToolCall`: one door for the proposal-approval replay of desk mutations, drift-guarded |
| Deskbot nRAG | `src/lib/server/ai/deskbot-rag.ts` | `retrieveDeskDocs` + `syncDeskFileToRag` over the user's own desk files (`source = 'desk'`, tiers 1–2) |
| Catalog citations | `src/lib/server/ai/catalog-citations.ts` | Post-hoc surface-citation verifier (exists/drifted/none) |
| Tool leak guard | `src/lib/server/ai/tool-leak-guard.ts` | Stream transform that suppresses Groq/llama textual tool-call markup |
| rawrag pipeline | `src/lib/server/rawrag/` | Source chunks, embeddings, hybrid/graph retrieval |
| llmwiki layer | `src/lib/server/llmwiki/` | Wiki layer: compile, search, verify |

## Documents

| File | Topics |
|------|--------|
| [knowledge-base.md](./knowledge-base.md) | **The integrating RAG blueprint + honesty map.** Terminology (rawrag engine vs llmwiki pointer layer; "nRAG = a connector/pointer over raw-RAG"); the wired-vs-scaffold table (llmwiki empty in prod, tier-3 dormant for docs, rag-demo tier-1-only, fabricated `vectorHits`/`bm25Hits` telemetry); corpus & chunking model (hierarchical parents+children, deterministic heading-breadcrumb prefix, SYSTEM_DOCS + system overview anchor, README exclusion); the recall-safety-net principle (pointer layer ∥ flat retrieval, ARAGOG / Anthropic −67%); retrieval-strategy seams (step-back → tiers → RRF k=60 → rerank → drill → verify → eval); data-model notes (embed-dimension SSOT, owner-aware overview, eval store, `:DEPENDS_ON`, per-surface schemas, `/admin/ai/rag/health`); tooling rationale (hand-rolled, pgvector/Neon, Neo4j verdict); **phased roadmap** (Phase C foundation built + browser-verified 2026-06-25 — tier-1-only chatbot grounding, partial quota-gated corpus; everything past it designed-not-built) + open product decisions |
| [rag-roadmap.md](./rag-roadmap.md) | **Quota-led design specs for the three LLM-amplifying retrieval features** (companion to knowledge-base.md; DESIGNED-not-built). Each spec leads with a quota-budget model against the ~20-req/day chat-gen free tier + shared-key embeddings. **Reranker** (slots between `fuseAndRank` `rawrag/index.ts:152` and context assembly; retrieve-wide→rerank-narrow; deterministic z-score fusion default, Cohere/Voyage as the quality ceiling — Voyage +13.89% NDCG, ARAGOG); **step-back query-transform** (1 LLM call before embed for BROAD queries only, gates on `shouldGroundFromSystemDocs`; generalized query feeds embed while rerank keeps the ORIGINAL; DeepMind +7–27%, HyDE hallucination caveat); **llmwiki auto-compile + recompile loop** (replaces the `COMPILE_SCAFFOLD`/`LINT_SCAFFOLD` scaffolds; auto-generated pages from rawrag chunks, `source_hash_at_compile` drift→recompile via a `markPagesStaleForChunks` marker that must still be BUILT (`verify.ts` exports only the read-side `verifyCitations` and writes nothing), NIGHTLY-BATCHED trigger, lint-nightly gate, consumes owner-aware `getOverview`). Build order + Phase-C dependencies |
| [surfaces.md](./surfaces.md) | **The naming contract.** chatbot (v10r expert, read-only grounded) vs deskbot (in-desk operator, mutating, plan-gated); explicit `surface`/`TurnSurface` dispatch (rag-demo retired 2026-08); per-surface routes (`/api/ai/chatbot` · `/api/ai/deskbot`) + shared `guardAiRequest`; harness split (`chatbotToolMeta`/`deskbotToolMeta`/`allToolMeta`, zero overlap, surface-neutral `ToolMeta`); one-door rule (`executeDeskToolCall` SSOT + drift guard) + approval gate (write/destructive → human-approved proposal, even single-target); nRAG = one shared kernel + two profiles/corpora; **location-awareness** (one concept, two profiles: chatbot **site-awareness** + deskbot **desk-awareness**, "same concept, different depth"); live-vs-planned status |
| [layered-rag.md](./layered-rag.md) | **Primary RAG doc.** Two-layer split (llmwiki + rawrag); **one shared `retrieve()` kernel, two profiles/corpora** (chatbot system-docs + deskbot user-files); catalog grounding (`search_catalog` incl. browse/enumerate `query:"*"` mode, `<catalog-map>`, citation chips); docs corpus (`search_project_docs`, system-owned, `db:ingest-docs`) + relevance-gated system-docs prefetch (`shouldGroundFromSystemDocs`); deskbot corpus (`source = 'desk'`, `desk_search_knowledge`/`desk:ask` read-only, `deskbot-rag.ts`, `desk-rawrag-sync` freshness); **graph tenancy** (per-tenant `:Chunk`/`:Entity`, owner-scoped reads, `deleteUserGraph` GDPR sweep); tool contracts, read path, citation verification |
| [provider-routing.md](./provider-routing.md) | Chat vs tool resolver split, `wantsTools` logic, Redis circuit breaker (cross-instance), provider quota & limits board (honest-board model, `/api/admin/ai/quota`), Groq drift + leak guard, **UI-message stream frame ordering** (single leading `start` vs duplicate-bubble split), practical consequences |
| [image-metadata.md](./image-metadata.md) | Image Metadata Reader showcase: vision resolver (`resolveVisionProvider`, Groq-excluded), `imagemeta` domain core + import wall, upload→strip→analyze→approve flow, GPS opt-in consent gate + GDPR surface, AI SDK v6 `Output.object` + Valibot re-validation, whole-form atomic approval, `image` pgSchema, reference cost panel (`pricing.ts`, derived-not-stored, thinking-token subset) |
| [image-kit.md](./image-kit.md) | Image Kit toolkit showcase (`/showcases/toolkits/image-kit`): one upload → Run → adjust → Approve flow over three tools (metadata + AI frame-cropper + embedder). **Persists nothing** (ephemeral R2 `showcase/imagekit/` + discard RPC + TTL); auth-gated v1 (userId-derived key, no signed handle). Merged single vision call (metadata + crop hint), **server-authoritative `snapToAspect` geometry** (model gives a hint, never pixels), caption-text (1536) vs multimodal-image (3072) embeddings, deterministic `attention`-crop comparison, ratio-locked corner-handle cropper. Greenfield-additive beside the reader |
| [cost-monitoring.md](./cost-monitoring.md) | Cross-surface admin **Cost** tab (`/admin/ai/cost`): unified Usage-by-Model table merging chat + image telemetry (app-layer `buildUnifiedModelUsage`, never SQL), reference-cost honesty model (derived/partial-coverage/thinking-subset), image health KPIs + save-vs-abandon funnel, Models→Cost relocation, no-$ Overview heartbeat |
| [graph-rag.md](./graph-rag.md) | rawrag internals: chunking, embeddings, parent-child, graph traversal, recursive retrieval; Phase 3 catalog `:Resource` seed |
| [desk-integration.md](./desk-integration.md) | **Superseded v4-era design record** (rationale, not the live contract — see [surfaces.md](./surfaces.md)): AI tool calling for desk operations, I/O log, effect system; deskbot posts `/api/ai/deskbot` |
| [toon.md](./toon.md) | TOON format for token-efficient RAG context injection |
| [site-awareness.md](./site-awareness.md) | **Site-aware chatbot — v1 BUILT + validate-green + browser-verified live (2026-06-27, dev/uncommitted; held from RAG).** The chatbot's [location-awareness](./surfaces.md#location-awareness--two-profiles) profile (**site-awareness** = which public route you're on; sibling of the deskbot's **desk-awareness**); **page-awareness** is the mechanism. Make Vely aware of the user's current route so "how does *this* work?" resolves to the page in front of you, with real citations. Insight: a showcase's normalized `page.route.id` **is** the catalog key (id-free, auth-filtered, public-only). Mechanism: `{ routeId }`-only wire (tight regex, miss→drop) → server `resolvePageContext` (catalog `Map`, `authCeiling`-gated) → passive `<current-page>` block (soft hint, variable tail) + **deixis-gated query-seed** reusing the existing prefetch embed (zero extra quota) + deterministic abstention on empty chunks. Security: **positive catalog allowlist** (admin/app/auth excluded *by construction*), server-resolved-strings-only trust firewall (T6 resolved — server-authored seed is safe; raw DOM/selected-text forbidden). UX: three-state context chip (resolved+corpus / muted-no-corpus / no-chip-off-policy) under the *"chip shown ⟺ route in prompt"* invariant, send-time binding, per-turn bubble stamp (`ai.message.route` column). Decisions: public-only LLM policy, persist the stamp, content-instance summarization out of v1 |
| [persistent-chatbot.md](./persistent-chatbot.md) | **Persistent / minimizable chatbot — BUILT + browser-verified, 2026-06-27 (dev, uncommitted).** The canonical deep-dive for the Vely chatbot lifecycle. 3-state machine `closed\|open\|minimized` in a **client-only module singleton** (`state/chatbot-session.svelte.ts`, SSR-safe via `browser`-gate + dynamic import; `SessionMonitor` teardown) that owns the live `Chat` so it survives the panel unmounting (minimize, in-group nav, cross-group `AppShell` remount, locale switch). `Chatbot.svelte` becomes a non-modal projection (`role="complementary"`); OPEN docks as a right-hand column on desktop (`md:pr-[28rem]`) / bottom sheet on mobile (`z-panel:25`); minimize via a synchronous delegated in-chat-link click handler (internal links same-tab), Esc, the **—** button, or another modal opening; sidebar trigger + mobile `VelyMinimizedBubble` restore with non-color alive-vs-answer-ready indicators; **sessionStorage** pointer → owner-scoped `conversations/[id]` rehydration (zero extra model calls, singleton-precedence guard). Removed from the `modals` store. **Deferred:** citation chips on a reloaded thread, `experimental_resume`. App-shell view: [../app-shell/ai-assistant.md](../app-shell/ai-assistant.md) |
| [nrag-observability.md](./nrag-observability.md) | **nRAG Observability redesign — BUILT + browser-verified-live (2026-06-27, dev/uncommitted; 16-agent task force); held from RAG until committed.** Replaces the rag-chat showcase's 5 mode pills + latency-bar rail + right drawer with one always-visible observability region under the chat. Core decisions: **modes → free post-hoc tier focus filter** over one fused run (zero extra generate quota; tiers run in parallel via `Promise.all`), `llmwiki` stays an **engine toggle** (mutually-exclusive branch; true single-run deferred to P4); **orientation = two views** (live vertical **Step view** → post-hoc horizontal **Timing waterfall**, not an axis rotation — Langfuse/Perplexity/Transformer-Explainer precedent); Timing spine + **Paths · Tokens** side-by-side→tabs (CSS grid + `@container`) bound by **cross-panel selection**. **Three orthogonal axes** (`NragPhase` stage / `RetrieverLane` source / existing `NragLayer` store), all homed in `pipeline.ts`. Contract delta: **`startedAt`→`startOffsetMs`** (turn-`t0`-relative, parallel-safe, wall-clock span total not a sum), closed `phase` discriminant + `PIPELINE_REGISTRY`, server-stamped `instanceKey`, required `requestId`, OTel-aligned token honesty (`systemPromptTokens` ungated, estimate-flagged). **6 bugs found** (stuck-`active` generate, counterfactual persists+meters→`dryRun`, admins blind to prompt in prod, summed total, untraced system-docs lane, zero llmwiki chips). One factory (`createNragTrace`) + generic `viz/timeline/Waterfall.svelte`. Plan: `~/.claude/plans/nrag-observability-redesign.md` |
| [harness-lens.md](./harness-lens.md) | "Harness" as an audit *lens* (not a module) over the bot's post-dispatch machinery — tool execution, safety gating, context compaction, state persistence, observability; primitive-ownership map across `ai/loop`, `ai/context`, `ai/policy`, `ai/tools`; surface-split tool metadata (`ToolMeta`/`DeskToolMeta`, `chatbotToolMeta`/`deskbotToolMeta`/`allToolMeta`); one-door `executeDeskToolCall` SSOT + drift guard; the tool-layer approval gate (`requiresApproval` → proposal) + `shouldRequirePlan` planning nudge |

## Architecture

```
Chatbot.svelte  → POST /api/ai/chatbot      → guardAiRequest → orchestrateChat({surface:'chatbot'})
ChatPanel.svelte → POST /api/ai/deskbot      → guardAiRequest → orchestrateChat({surface:'deskbot'})
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
