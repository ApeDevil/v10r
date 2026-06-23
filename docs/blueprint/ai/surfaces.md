# AI Surfaces: chatbot & deskbot

The AI subsystem serves **two product surfaces** (plus one showcase demo) through **one endpoint and one orchestrator**. They are told apart by an explicit `surface` discriminant — not by implicit request-flag truthiness.

## The two surfaces

| | **chatbot** | **deskbot** |
|---|---|---|
| **Role** | The v10r **expert** — *why* and *how* the project is built | The in-desk **operator** — does anything a user can do via the desk UI |
| **Mode** | Read-only, grounded, citation-faithful Q&A | Agentic, mutating, plan-gated |
| **Route** | `POST /api/ai/chatbot` | `POST /api/ai/deskbot` |
| **Client** | `composites/chatbot/Chatbot.svelte` (floating widget) | `chat/ChatPanel.svelte` (desk panel) |
| **Harness** | `buildRetrievalTools()` → `chatbotToolMeta` | `createDeskTools()` → `deskbotToolMeta` |
| **Tools** | `search_catalog`, `search_project_docs`, `get_llmwiki_pages`, `get_rawrag_chunks`, `resolve_ref` | `desk_*` read/write/create/delete, `desk_propose_plan`, `resolve_ref` |
| **System prompt** | `SYSTEM_PROMPT` (plain) | `DESK_SYSTEM_PROMPT` (XML-tagged) + permissions + desk-context |
| **Corpus (nRAG)** | System-owned (`source IN docs,catalog`, `SYSTEM_DOCS_USER_ID`) + per-user llmwiki — curated, graph-seeded, static | The user's **own** desk files — per-user, mutable, not graph-seeded, private |
| **Invariants** | Never emits a `DeskEffect`; never creates a proposal | All mutations route through `db/desk`; destructive batches gate through `shouldRequirePlan` |

A third value, `rag-demo`, drives the showcase retrieval-pipeline demo. It is **not a product surface** and must not dilute the chatbot.

## Dispatch — the `surface` discriminant

`ChatInput.surface: TurnSurface` (`'chatbot' | 'deskbot' | 'rag-demo'`) is the single named dispatch decision in `chat-orchestrator.ts`. The three per-surface routes set it explicitly:

| Route | Surface |
|---|---|
| `POST /api/ai/chatbot` | `orchestrateChat({ surface: 'chatbot' })` |
| `POST /api/ai/deskbot` | `orchestrateChat({ surface: 'deskbot' })` |
| `POST /api/ai/showcase/rag` | derived (the rag-chat showcase toggles `useLlmwiki` vs. raw retrieval) |

All three share one entry guard, `guardAiRequest()` (`guard.ts`), which dedups auth → `aiConfigured` → rate-limit → daily-budget so the routes stay thin and the rate-limit key can't drift across copies. When `surface` is absent it is derived from the legacy `useLlmwiki`/`useRetrieval` flags (so the bare showcase clients keep working). The retrieval surfaces additionally require a *fresh user turn* — resume turns degrade to the plain deskbot streaming path, where the desk tools are filtered to **read-only** (`desk:read`/`desk:ask`): the approved plan has already run via the deterministic approve-route replay, so the acknowledgement turn physically cannot re-mutate. Approval binds execution.

```
orchestrateChatInner → resolve surface →
  surface === 'chatbot'  → llmwiki-first grounded turn (+ relevance-gated system-docs prefetch)
  surface === 'rag-demo' → showcase retrieval demo
  surface === 'deskbot'  → agentic desk tool loop (default; also handles resume turns, which mount read-only desk tools only)
```

## Harness split (zero tool overlap)

The two tool collections are **physically and semantically disjoint** and grow independently:

- `chatbotToolMeta` — read-only retrieval tools. **No `scope` field** (uses surface-neutral `ToolMeta`/`ToolRisk`).
- `deskbotToolMeta` — desk CRUD/action tools, each carrying its gating `DeskToolScope` (`DeskToolMeta`).
- `allToolMeta` — the union, for admin/telemetry that needs every tool regardless of surface.

A chatbot tool never carries a desk scope; a deskbot tool always does. The `/admin/ai/tools` topology view derives branch from membership (`name in chatbotToolMeta`), not from a scope artifact.

## One-door rule (deskbot mutations)

Every deskbot mutation has **two entry edges** — the in-loop tool `execute`, and the proposal-approval replay (`POST /api/ai/proposals/[id]/approve`). Both route through the single SSOT `executeDeskToolCall()` (`tools/desk-execute.ts`). For the replay to execute the approved plan, the persisted proposal payload carries each step's `args` (the model supplies them on `desk_propose_plan`); an empty-args payload would silently no-op (`executeDeskToolCall(tool, {})` → "File not found"), so the approval would bind nothing.

Two tests guard distinct properties of the door. `index.test.ts` drift-guards tool *name* coverage — it fails if a mutating deskbot tool lacks a replay case, so the replay path can never silently fall behind the live tool set. `desk-execute.test.ts` separately guards that *args* round-trip — empty args must surface "File not found" (never a fake success), and real args must reach the desk mutation verbatim.

## nRAG: one shared kernel, two profiles, two corpora

The retrieval **engine** (`rawrag/retrieve()` — embed → tiers → RRF fusion → drill, with the single `user_id` tenant-isolation filter) is **shared mechanism**. The two surfaces exercise it as distinct **profiles**:

| | chatbot profile | deskbot profile |
|---|---|---|
| Corpus | `SYSTEM_DOCS_USER_ID` (docs/catalog) + per-user llmwiki | The user's own desk files |
| Tiers | 1–3 (graph tier is valuable — catalog is Neo4j-seeded) | 1–2 (no graph — desk files aren't graph-seeded) |
| Grounding | Relevance-gated system-docs prefetch + llmwiki + on-demand drill; post-stream citation verification | `desk:ask` read-only tool (`desk_search_knowledge`); no citation chips. Read-only: excluded from `hasMutatingScope`/`stepsForScopes`/the plan gate — it never triggers plan-before-execute (only the turn's mutating tools do) |
| Freshness | Static curated corpus | Mutable — `aiContext` opt-in; reconciled off the hot path by the `desk-rawrag-sync` job (polls `updatedAt`), not on each save |

The kernel is never forked (a duplicated `user_id` filter would be a cross-tenant-leak risk); the corpus boundary is purely `document.userId`.

## Status

**Live:** the naming + dispatch discriminant; the **per-surface route split** (`/api/ai/chatbot` · `/api/ai/deskbot` · `/api/ai/showcase/rag`) behind the shared `guardAiRequest`; the harness split (zero overlap); the one-door rule (plan payload carries per-step `args`, replayed verbatim; resume turns mount read-only desk tools — approval binds execution); the `surface` analytics column (`ai_surface` enum on `ai.conversation` + `conversation_step`, stamped at creation, `conv_step_surface_idx`); the chatbot nRAG profile (relevance-gated system-docs prefetch); and the **deskbot nRAG profile** — `desk:ask` read-only grounding tool (`desk_search_knowledge`) over the user's own `aiContext` desk files, ingested via the shared kernel (`source = 'desk'`) and kept fresh by the `desk-rawrag-sync` job (polls `desk.file.updatedAt`).

**Planned:** the physical `_shared`/`chatbot`/`deskbot` directory layout — all three surfaces still dispatch from one `chat-orchestrator.ts`. Also planned: per-surface Valibot request schemas (both routes share `ChatRequestSchema` today) and a declarative `ToolDescriptor` manifest backed by a DB `ai_tool` registry.
