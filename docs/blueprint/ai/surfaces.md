# AI Surfaces: chatbot & deskbot

The AI subsystem serves **two product surfaces** through **one orchestrator**. They are told apart by an explicit `surface` discriminant — not by implicit request-flag truthiness.

## The two surfaces

| | **chatbot** | **deskbot** |
|---|---|---|
| **Role** | The v10r **expert** — *why* and *how* the project is built | The in-desk **operator** — does anything a user can do via the desk UI |
| **Mode** | Read-only, grounded, citation-faithful Q&A | Agentic, mutating, approval-gated |
| **Route** | `POST /api/ai/chatbot` | `POST /api/ai/deskbot` |
| **Client** | `composites/chatbot/Chatbot.svelte` — persistent, minimizable, non-modal panel; live thread owned by the `chatbot-session` singleton (see [../app-shell/ai-assistant.md](../app-shell/ai-assistant.md)) | `chat/ChatPanel.svelte` (desk panel) |
| **Harness** | `buildRetrievalTools()` → `chatbotToolMeta` | `createDeskTools()` → `deskbotToolMeta` |
| **Tools** | `search_catalog`, `search_project_docs`, `search_pattern_library`, `get_llmwiki_pages`, `get_source_chunks` (5) | `desk_*` read/write/create/delete, `desk_search_knowledge`, `desk_propose_plan` (13) — zero overlap with the chatbot set. (`resolve_ref` mounts on both harnesses but is compaction infra, deliberately outside `TOOL_MANIFEST`.) |
| **System prompt** | `SYSTEM_PROMPT` (plain) | `DESK_SYSTEM_PROMPT` (XML-tagged) + permissions + desk-context |
| **Corpus (retrieval)** | System-owned (`source IN docs,catalog`, `SYSTEM_DOCS_USER_ID`) + per-user llmwiki — curated, static (catalog slice graph-seeded; docs-corpus graph tier dormant) | The user's **own** desk files — per-user, mutable, not graph-seeded, private |
| **Location-awareness** | **site-awareness** — the current public route as a thin server-resolved page label (public-catalog only); _v1 built (dev, uncommitted), see [site-awareness.md](./site-awareness.md)_ | **desk-awareness** — live desk state (`panelContext`/`deskLayout`/`activeWorkspace`): which panels & files are open; _live_ |
| **Invariants** | Never emits a `DeskEffect`; never creates a proposal | All mutations route through `db/desk`; write & destructive tools require human approval (proposal → approve-route), never mutating in-loop; only reversible creates run in-loop |

(A third `rag-demo` value once drove the showcase retrieval-pipeline demo; it was retired 2026-08 when the architecture pages at `/showcases/ai/chatbot` + `/showcases/ai/deskbot` absorbed the retrieval pedagogy — `TurnSurface` is a closed two-member union again.)

## Dispatch — the `surface` discriminant

`ChatInput.surface: TurnSurface` (`'chatbot' | 'deskbot'`) is the single named dispatch decision in `chat-orchestrator.ts`. The two per-surface routes set it explicitly — it is a **required** field, never derived from request flags (the legacy `useLlmwiki`/`useRetrieval` derivation was removed with the rag-demo surface):

| Route | Surface |
|---|---|
| `POST /api/ai/chatbot` | `orchestrateChat({ surface: 'chatbot' })` |
| `POST /api/ai/deskbot` | `orchestrateChat({ surface: 'deskbot' })` |

Both share one entry guard, `guardAiRequest()` (`guard.ts`), which dedups auth → `aiConfigured` → rate-limit → daily-budget so the routes stay thin and the rate-limit key can't drift across copies. The chatbot surface additionally requires a *fresh user turn* — resume turns degrade to the plain deskbot streaming path, where the desk tools are filtered to **read-only** (`desk:read`/`desk:ask`): the approved plan has already run via the deterministic approve-route replay, so the acknowledgement turn physically cannot re-mutate. Approval binds execution.

```
orchestrateChatInner → resolve surface →
  surface === 'chatbot'  → llmwiki-first grounded turn (+ relevance-gated system-docs prefetch)
  surface === 'deskbot'  → agentic desk tool loop (default; also handles resume turns, which mount read-only desk tools only)
```

## Harness split (zero tool overlap)

The two tool collections are **physically and semantically disjoint** and grow independently:

- `chatbotToolMeta` — read-only retrieval tools. **No `scope` field** (uses surface-neutral `ToolMeta`/`ToolRisk`).
- `deskbotToolMeta` — desk CRUD/action tools, each carrying its gating `DeskToolScope` (`DeskToolMeta`).
- `allToolMeta` — the union, for admin/telemetry that needs every tool regardless of surface.

A chatbot tool never carries a desk scope; a deskbot tool always does. The `/admin/ai/tools` topology view derives branch from membership (`name in chatbotToolMeta`), not from a scope artifact.

## One-door rule (deskbot mutations)

Every deskbot mutation flows through the single SSOT `executeDeskToolCall()` (`tools/desk-execute.ts`) — the **one door**. **Write and destructive** tools never mutate in the agent loop: their `execute` validates the target and returns a `requiresApproval` sentinel, which the orchestrator turns into a pending `agent_proposal` (a PlanCard). That mutation runs **only** via the proposal-approval replay (`POST /api/ai/proposals/[id]/approve`), which records a real `approvedBy`/`approvedAt`. Reversible **creates** (soft-delete-recoverable) mutate in-loop, auto-approved. For the replay to execute the approved plan, the persisted proposal payload carries each step's `args` (the model supplies them on `desk_propose_plan`); an empty-args payload would silently no-op (`executeDeskToolCall(tool, {})` → "File not found"), so the approval would bind nothing.

Two tests guard distinct properties of the door. `index.test.ts` drift-guards tool *name* coverage — it fails if a mutating deskbot tool lacks a replay case, so the replay path can never silently fall behind the live tool set. `desk-execute.test.ts` separately guards that *args* round-trip — empty args must surface "File not found" (never a fake success), and real args must reach the desk mutation verbatim.

## Retrieval: one shared kernel, two profiles, two corpora

The subsystem is called **retrieval** everywhere — `server/retrieval/`, `/api/retrieval/*`, the `retrieval` pgSchema and `/admin/ai/retrieval`. It spans the chunk engine and the `llmwiki` pointer layer (curated TLDR-with-chunk-pointers over the immutable source chunks), so a definition naming only the engine is incomplete. The informal umbrella "retrieval" was retired in favour of the one word the code uses.

The retrieval **engine** (`retrieval/retrieve()` — embed → tiers → RRF fusion → drill, with the single `user_id` tenant-isolation filter) is **shared mechanism**. The two surfaces exercise it as distinct **profiles**:

| | chatbot profile | deskbot profile |
|---|---|---|
| Corpus | `SYSTEM_DOCS_USER_ID` (docs/catalog) + per-user llmwiki | The user's own desk files |
| Tiers | Designed 1–3 (graph tier valuable — catalog is Neo4j-seeded); **live: the chatbot requests tier-1 only** — tiers 2–3 unexercised by the chatbot today | 1–2 (no graph — desk files aren't graph-seeded) |
| Grounding | Injected `<project-overview>` system-overview anchor + relevance-gated system-docs prefetch + llmwiki + on-demand drill; post-stream citation verification | `desk:ask` read-only tool (`desk_search_knowledge`); no citation chips. Read-only: excluded from `hasMutatingScope`/`stepsForScopes`/the plan gate — it never triggers plan-before-execute (only the turn's mutating tools do) |
| Freshness | Static curated corpus | Mutable — `aiContext` opt-in; reconciled off the hot path by the `desk-retrieval-sync` job (polls `updatedAt`), not on each save |

The kernel is never forked (a duplicated `user_id` filter would be a cross-tenant-leak risk); the corpus boundary is purely `document.userId`.

## Context assembly — one door, plus an x-ray

Everything that decides what enters the **chatbot's** system prompt — the triviality gate (`shouldGroundFromSystemDocs`), the deixis gate (`referencesCurrentPage`), the single shared query embedding, the parallel llmwiki/system-docs retrieval, and the block-by-block injection (llmwiki context → `<project-overview>` → `<retrieval-context>` → `<current-page>` → catalog map) — lives in one module: `assembleChatbotContext` in `src/lib/server/ai/context-assembly.ts`. The **deskbot's** base-prompt half is the ordered block list from `buildSystemPromptBlocks` (`context/system-prompt.ts`) plus the plan governor (`hasDestructiveIntent`/`shouldRequirePlan`, `policy/governor.ts`).

`POST /api/ai/context-probe` exposes that same pre-generation half as a read-only report — it powers the "Context orchestration" (`#probe`) section on `/showcases/ai/chatbot` and `/showcases/ai/deskbot`. Given `{ surface, query, pageRouteId?, toolScopes? }` it runs the SAME assembly code with a widened candidate pool and returns: gate verdicts, per-lane corpus inventory, ranked candidates with the production cutoff marked (chosen vs available-but-passed-over), and a prompt-block outline tagged static vs per-request (ids + token estimates, never bodies). It **never calls the LLM** — worst case one embedding; trivial queries, empty corpora, and missing scopes spend nothing — and it sits behind `guardAiRequest` like every other AI endpoint. Because the orchestrator and the probe share one door, the showcase structurally cannot drift from production.

## Location-awareness — two profiles

Each surface knows **where the user currently is**, so deixis ("this", "here") resolves to their actual location. This is **location-awareness** — one idea, two surface-specific profiles:

- **site-awareness** (chatbot) — Vely's awareness of the public route you're viewing, as a thin server-resolved page label (public-catalog routes only, never the raw path or DOM). *v1 built (dev, uncommitted) — see [site-awareness.md](./site-awareness.md).*
- **desk-awareness** (deskbot) — the deskbot's awareness of your live desk state: which panels and files are open (`panelContext`/`deskLayout`/`activeWorkspace`), first-party and mutable. *Live.*

**Same concept, different depth.** Site-awareness and desk-awareness are two profiles of one idea — ground the user's *here*/*this* in their current location — at deliberately unequal depth. Desk-awareness is rich, first-party, and mutable (full panel and file content); site-awareness is intentionally thin — a single server-resolved route label, public-catalog routes only, never DOM-scraped. The asymmetry is **by design, not a parity gap**: deeper page extraction (DOM, selected text) is a standing security finding, not missing work.

The **mechanism** behind site-awareness is **page-awareness** — resolving `page.route.id` to a `<current-page>` label. "Location-awareness" is the family, "site-awareness"/"desk-awareness" the two profiles, and "page-awareness" the chatbot-side mechanism. Full design: [site-awareness.md](./site-awareness.md).

## Status

**Live:** the naming + dispatch discriminant; the **per-surface route split** (`/api/ai/chatbot` · `/api/ai/deskbot`) behind the shared `guardAiRequest`; the harness split (zero overlap); the one-door rule (plan payload carries per-step `args`, replayed verbatim; resume turns mount read-only desk tools — approval binds execution); the **tool-layer approval gate** (every write/overwrite/delete — even single-target — returns a `requiresApproval` sentinel and mutates only through a human-approved proposal recorded with `approvedBy`/`approvedAt`; the model-minted `confirmed` self-handshake is gone; `shouldRequirePlan` widened to `mutatingScopeGranted && destructiveIntent`, now soft planning guidance; a pre-image `desk.file_revision` snapshot makes an approved overwrite/delete recoverable); the `surface` analytics column (`ai_surface` enum on `ai.conversation` + `conversation_step`, stamped at creation, `conv_step_surface_idx`); the chatbot retrieval profile (relevance-gated system-docs prefetch); and the **deskbot retrieval profile** — `desk:ask` read-only grounding tool (`desk_search_knowledge`) over the user's own `aiContext` desk files, ingested via the shared kernel (`source = 'desk'`) and kept fresh by the `desk-retrieval-sync` job (polls `desk.file.updatedAt`).

**Browser-verified 2026-06-25:** the chatbot's Phase-C foundation grounding is live — an injected `<project-overview>` system-overview anchor (`loadOverview([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID)`) plus **tier-1-only** retrieval. The anchor is the load-bearing fix for the original broad-question bug: "how do I use v10r?" now answers correctly with real `/docs/...` citations (5/5 functional probes green). Hierarchical docs chunking landed too, but is groundwork for future tier-2 surfaces — it does not change chatbot answers today, and the corpus conversion is partial (36/93 docs, quota-gated). See [knowledge-base.md](./knowledge-base.md#wired-vs-scaffold-the-honest-map).

**Planned:** the physical `_shared`/`chatbot`/`deskbot` directory layout — both surfaces still dispatch from one `chat-orchestrator.ts` (the chatbot's context-assembly half is already extracted to `context-assembly.ts`). Also planned: a DB `ai_tool` registry behind the declarative `TOOL_MANIFEST`. **Site-awareness** — the chatbot's [location-awareness](#location-awareness--two-profiles) profile ([site-awareness.md](./site-awareness.md)) — is built and live; its sibling **desk-awareness** ships as the deskbot's `panelContext`/`deskLayout` injection.
