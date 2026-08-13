# nRAG Observability

> **Status update (2026-08-13): the rag-chat showcase UI this doc describes was RETIRED** — the retrieval showcase tree (`/showcases/ai/retrieval/*`) and the `rag-demo` surface (`POST /api/ai/showcase/rag`, `dryRun`) were deleted when the AI-surface architecture pages landed. The trace/event **contracts remain live**: the `pipeline:*` metadata frames and `$lib/types/pipeline.ts` (registry, phases, lanes, `startOffsetMs` semantics) now feed the `/showcases/ai/chatbot` page's recorded/live trace viewer (`$lib/showcase/ai/replay.ts`). Read the design decisions below as the record behind those contracts, not as a live page description.

> **Original status: BUILT + validate-green + browser-verified-live (2026-06-27, dev, UNCOMMITTED).** 16-agent task force (ARY · SYS · SVEY · UXY · DATY · APY · RESY · SCOUT, two cross-pollination rounds) → full implementation. P1–P3 done; P4 (true single-run) deferred. Verified: rag-chat type-clean (real `svelte-check`; note the project's `svelte-check-rs` gate is stubbed → use `bunx svelte-check`), rag-chat 17/17 + server 299/299 tests green, biome clean, zero net new project errors. Browser-proven: waterfall shows the three tiers starting at the same offset (true parallel overlap), wall-clock span total (1981ms, not the summed 2124ms), Step⟷Timeline toggle, Paths/Tokens panes, token Measured-vs-~Estimated honesty, "Run without RAG" counterfactual. Held from the RAG corpus until committed + re-ingested, so the chatbot can't assert it as live. Implementation plan: `~/.claude/plans/nrag-observability-redesign.md`.

## What this is

The rag-chat showcase teaches how v10r's nRAG retrieval works **and** doubles as a working chat. Today the trace is fragmented: five mode pills (`Vector` / `Small-to-Big` / `Entity Graph` / `LLM Wiki` / a gamified-unlock `All Three Fused`), a compact "latency bar" rail, and a right-side drawer that most users never open. The bar isn't a real waterfall, the modes fragment one pipeline into five page-states, and the most interesting fact — that the retrieval tiers run **concurrently** — is invisible.

The redesign collapses all of that into **one always-visible "nRAG Observability" region under the chat** with three coordinated views (Timing · Paths · Tokens), the retrieval modes demoted from page-states to a free post-hoc **focus filter** over a single fused run.

## The core decisions

### 1. One fused run, modes → focus filter

The four rawrag modes were just different `retrievalTiers`/`fusion` flags on **one `retrieve()` call**. Always running fused (`tiers:[1,2,3], fusion:'rrf'`) costs **zero extra generate quota** — tiers run in parallel (`Promise.all`, `rawrag/index.ts:102-146`), embedding is paid once, and there is one generate call per turn either way (only DB/Neo4j load increases). "What did the Entity Graph tier contribute?" becomes a **client-side filter** over the already-captured `tierChunks` — no re-run, no quota spent. The only turn-spending experiment is the counterfactual ("run without RAG").

`llmwiki` is **not** a tier — it is a separate, mutually-exclusive orchestrator branch (`chat-orchestrator.ts:567` vs `:1058`, one `surface`/`streamText` per turn). It stays an **engine toggle** ("Hybrid tiers ⟷ LLM Wiki"). Running *both* engines into one generate (a true single-run) is a deliberately **deferred Phase 4** (needs prompt fusion + tool-surface unification + an aiy/sys call). The observability unifies the **view and the vocabulary** now; it does not pretend both engines ran when only one did.

The gamified "unlock fused" gate is **removed** (obsolete once fused is the default).

### 2. Orientation = two *views*, not an axis rotation

The user asked for a horizontal/vertical toggle. Rotating a waterfall's time axis 90° has **zero precedent** in any ops *or* teaching tool and is a code fork (RESY, SCOUT). The evidence-backed form (Langfuse's praised tree/timeline toggle; Perplexity, v0, Transformer-Explainer for live UIs) is **two views of the same trace**:

- **Step view (vertical, live).** While the turn streams, a vertical step list: `pending → pulsing → ✓`, with latency/token numbers filling in as each step *ends*. You cannot draw honest bar widths until timing is known, and live-growing Gantt bars look broken — so nobody animates them. The step list teaches **sequence + causal dependency**.
- **Timing view (horizontal, post-hoc).** After completion, the horizontal waterfall — the only layout that legibly shows the **parallel-tier overlap** (the headline lesson). It teaches **relative cost + concurrency**.

The live → complete transition *is* the pedagogy; the toggle lets you flip between them afterward. Both encode time → left-to-right.

### 3. Times · Paths · Tokens, coordinated

- **Timing** is the always-visible spine (Step or Timing view).
- **Paths** (provenance) and **Tokens** (breakdown) sit beside it: **side-by-side panes on wide viewports, collapsing to tabs on narrow** (CSS grid + `@container`, *not* paneforge). An opt-in "Expand all" stacks all three full-width.
- **Cross-panel selection** binds them (Transformer-Explainer pattern, native Svelte reactivity): click a step → Paths filters to that step's chunks, Tokens highlights its contribution; click a chunk → its source step highlights.

## The three orthogonal axes (taxonomy)

"Layer" was overloaded. There are **three independent axes**, all homed in `src/lib/types/pipeline.ts`:

| Axis | Type | Tags | Members |
|------|------|------|---------|
| **Stage** (temporal) | `NragPhase` | steps | `embed · retrieve · fuse · assemble · generate · verify` |
| **Lane** (source) | `RetrieverLane` | tierChunks keys + retrieve steps | `tier-1 · tier-2 · tier-3 · llmwiki` |
| **Store** (corpus) | `NragLayer` *(existing)* | chunks | `llmwiki · rawrag · catalog · docs` |

The Timing waterfall lays out by **Stage**; the Paths panel groups/colors by **Lane**; the admin diagram (`admin/ai/nrag-pipeline.ts`) uses the **Store** axis. `drill` is a step *inside* the `retrieve` phase (its mid-generate timing is expressed by `startOffsetMs`, not its own phase); `wiki`-ness is the `path` field, not a phase. The `Store` axis (`NragLayer`) moves to a client-safe shared home so both admin and showcase import it (no drift).

## Contract delta (`src/lib/types/pipeline.ts`)

Target shape (no backward-compat shim — dev project). Key changes:

- **`startedAt` → `startOffsetMs`** on `PipelineStepEvent`: server-authoritative, **turn-`t0`-relative** ms, stamped on the **`active`** emit only. Replaces the half-wired raw `startedAt` (emitted only by the llmwiki branch today, dropped by both client factories). Enables true overlap geometry; clock-skew-free (one `performance.timeOrigin` per process).
- **Closed `phase: NragPhase`** discriminant on every step event + exhaustive `PHASE_OF: Record<PipelineStepId, NragPhase>` (a missing tag is a compile error). The viz switches on `phase`, never string-matches step ids.
- **`PIPELINE_REGISTRY`** (descriptors `{ id, label, phase, path:'rawrag'|'llmwiki'|'both', lane?, dynamic? }`) replaces `PIPELINE_STEPS` + `LLMWIKI_STEPS`.
- **`instanceKey`** (server-stamped; `= id` except `rawrag:drill → drill#${ordinal}`) — stable list keys, avoids the `each_key_duplicate` class of crash.
- **`requestId` promoted to required** on step/chunks/prompt/citations events — partitions sub-pipelines, defines a hard per-turn reset boundary, and retires the fragile index-based `annotationCursor`.
- **`tierChunks`** typed `Partial<Record<RetrieverLane, ChunkSummary[]>>` (was `Record<string, …>`); `ChunkSummary.source`/`tier` typed; `retrieverScores` widened to `Partial<Record<RetrieverKind, number>>` (so bm25 stops folding into vector); `survivalReason → dispositionReason`, **always populated** incl. drop reasons (`below_top_k`, `rrf_cutoff`).
- **Token honesty** (`TokenBreakdown`, OTel-GenAI-aligned names): `inputTokens`/`outputTokens` real; `reasoningTokens` (subset of output), `cachedInputTokens` (subset of input); **`systemPromptTokens`** a real ungated count (a count is not a leak — context lives *inside* the system prompt, so `baseSystem ≈ systemPromptTokens − contextEstimate`); context tokens flagged `estimated` (chars/4). Per-tier and per-drill token attribution are **declared impossible** (`totalUsage` is aggregate), never faked.
- A single **`generate` error terminal** (status `'error'`) so the bar can't hang.

## Runtime / instrumentation (server)

One turn `t0 = performance.now()` captured at the top of each orchestrator `execute`, threaded into `retrieve(query, opts, onEvent, t0)`; every `active` emit computes `startOffsetMs = Math.round(performance.now() − t0)`. The retrieval engine keeps its own `start` for the returned (pure-retrieval) `durationMs`.

- **Wall-clock total**, never a sum: `max(startOffsetMs + durationMs) − min(startOffsetMs)`. Today both factories `reduce(+durationMs)`, triple-counting the parallel tiers.
- **`generate:error`** wired to the inner `streamText` `onError` + the 30 s `AbortSignal.timeout` `onAbort` in both branches, plus a client `finalizeActive()` backstop (flips a lingering `active` → `error` when `chat.status` settles).
- **System-docs lane:** the chatbot branch's parallel tier-1 system-docs retrieve (`chat-orchestrator.ts:654-662`) is invisible today except on error. Bracket-time it as **one coarse `system-docs` step** in the parallel band (do *not* pass the engine `onEvent` through — its sub-step ids collide with the llmwiki registry).
- **Drills** = point ticks nested **by time** inside the generate bar (no fabricated per-drill duration). The waterfall places every bar by `startOffsetMs`; registry order is only the fallback backbone for not-yet-started steps.
- **Delivery rule (do not violate):** trace events ship as `message-metadata` frames carrying the **full accumulated array** (REPLACE semantics) — never deltas, never transient `data-*` parts. The assistant frame MUST open with an explicit `writer.write({type:'start', messageId})` **before** the first metadata write, and the merged text stream MUST suppress its own start via `toUIMessageStream({ sendStart:false })`. Violating either re-splits the answer into a duplicate empty avatar.

## Bugs found (independent of the redesign)

1. **`generate` has no error terminal** — on a Gemini quota 503 / timeout the trace bar hangs `active` forever (`done` lives only in `onFinish`).
2. **Counterfactual persists + meters** — the "run without RAG" call creates a real conversation, saves rows, and counts against the user's limit. Fix: `dryRun?: boolean` on `ChatRequestSchema` → skip `resolveConversation`/`saveMessages`/limit (all are `conversationId`-gated) but **still `chargeTokens`** (tokens were really spent; skipping budget would be a metered-bypass abuse vector). Counterfactual becomes a second typed `Chat` instance on the same transport; delete the hand-rolled SSE reader (`TraceDrawer.svelte:43-65`).
3. **Admins never see the full prompt in prod** — `isDevOrAdmin = import.meta.env.DEV` (`chat-orchestrator.ts:599,1107`). Gate prompt **text** with the real `ADMIN_USER_ID` predicate (confirm with secy); **never** gate token **counts**.
4. **Inflated total** — `totalDurationMs` sums parallel tier durations.
5. **Untraced system-docs retrieve** (see above).
6. **llmwiki has zero demo chips** (`demo-queries.ts`, silent `?? []`).

## Component homes

- **Generic primitive** `src/lib/components/viz/timeline/Waterfall.svelte` + `viz/timeline/types.ts` — domain-agnostic `WaterfallRow[]` (`{ id, label, startOffsetMs, durationMs, status, color, laneId?, groupId?, depth?, parentId? }`), `orientation` prop, `totalMs` (explicit span). **Must not import `$lib/types/pipeline`** — route adapters map pipeline → row. `cycle/CycleWaterfall.svelte` becomes a thin adapter too.
- **One trace factory** `…/rag-chat/_components/trace/nrag-trace.svelte.ts` (`createNragTrace` over `PIPELINE_REGISTRY`, `path`-filtered, `instanceKey`, optional `citations`) — replaces `rawrag/rawrag-trace.svelte.ts` + `llmwiki/llmwiki-trace.svelte.ts`. **Views stay split** (`trace/rawrag/` chunk cards, `trace/llmwiki/` page+citation+graph-path cards — llmwiki provenance has no similarity score, so it needs a distinct card shape).
- **Shell** `…/_components/NragObservability.svelte` (replaces `TraceRail` + `TraceDrawer`): owns the engine toggle, tier focus filter, Step/Timing + layout prefs (localStorage), and the Timing/Paths/Tokens panes. Selection state reuses the factory's existing `selectedStepId`/`selectStep`.
- **Deleted:** `ModeSelector.svelte` (+ `RagMode`), `TraceRail.svelte`, `TraceDrawer.svelte`.

## Accessibility

Bars are `<button>` with a roving tabindex (one group tab-stop, arrows between, Enter → detail/cross-link); status is icon + text, never color alone; durations rendered as text. Live region: container `aria-live="polite" aria-busy="true"` during the turn, `false` on completion → one summary; an off-screen `role="status"` emits one sentence per step completion (not per frame). `prefers-reduced-motion` removes the fill animation and width transition. A visually-hidden `<table>` (step · start · duration · status) is the canonical non-visual waterfall.

## Phasing

- **P1 — Contract + instrumentation.** Rewrite `pipeline.ts` (3 axes, `startOffsetMs`, registry, token honesty); SYS's server change-list (turn-`t0`, `generate:error`, system-docs lane, `requestId`, `dryRun`); fix the 6 bugs.
- **P2 — Components.** Generic `Waterfall` primitive; `createNragTrace`; `NragObservability` shell + Timing/Paths/Tokens panes + cross-panel selection; delete drawer/rail/ModeSelector.
- **P3 — Teaching polish.** Step↔Timing toggle, tier focus filter, layer legend, counterfactual-as-action, re-curated demo chips (→ cony), full a11y pass.
- **P4 — Deferred.** True single-run (both engines → one generate); aiy/sys.

## Deferred / open

- **True single-run** (Phase 4) — until then, the engine toggle is honest: one engine per turn, the other's lanes render as "not run," not empty.
- **Reranker / step-back** instrumentation (see [rag-roadmap.md](./rag-roadmap.md)) would add `fuse`-phase sub-steps — the registry + phase axis already accommodate them.
- Exact layout breakpoints (split ~1100px, stack ~560px, orientation auto-switch) → laly.
