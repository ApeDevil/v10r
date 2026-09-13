# Turn trace

> **Status: BUILT 2026-09-12 (Phases 1, 3 and 5 of the AI context + trace refactor),
> validate-green; the turn graph and the recorded ancestry landed 2026-09-13.** Requires the
> `db:rename-conversation-step` script and one interactive `db:push` before a turn can persist.
> Phase 2 (profiles, [profiles.md](./profiles.md)) sits under it; Phase 4 (the pointer-layer
> retirement) landed the same day; Phase 5 gave the deskbot page the same inspector.

## What this is

Every chatbot and deskbot turn now leaves **one recorded account of itself**: what was available
to it, what each grounding source considered, what entered each model call's request, which
tools ran with what result, how the provider attempts went, and what the answer cited. It is
recorded from the actual execution — never a second run — streamed to the client while the
turn runs, written once when it finishes, and read back by the turn's owner.

Before this, the chatbot streamed `pipeline:*` events as `message-metadata` and dropped them;
`conversation_step` held tokens/provider/model/duration per SDK step and nothing else; chatbot
tool calls were never persisted; a reloaded thread had no citations; the full prompt text was
gated to dev builds and admins; the showcase's "Context orchestration" was a separate run.

## The contract

`$lib/types/turn-trace.ts` — framework-free, imported by the server recorder, the chat
components and the showcase's turn inspector.

```
TurnTrace
├─ messageId · conversationId · surface · requestId · profileVersion · outcome · errorKind
├─ timings        preStreamMs · embedMs · generateMs · firstTokenMs[] · finalize{catalog,persist,budget}
├─ awareness      locale · authCeiling · page (chatbot) · scopes · workspace · layout · panels (deskbot)
├─ activations    { id: CapabilityId, active, reason }   every capability's verdict for the turn
├─ blocks         { id, capability, section, text, chars, stable }   the system prompt, block by block, WITH text
├─ grounding      per source: ran · skippedReason · error · pool · cutoff · retrievers · items[]
│                 item: id · kind (chunk|catalog|map) · title · score · rank · state · blockId · omittedReason · path · catalog
│                       chunk place: parentId · level · position · contentHash · retriever   tool-surfaced: toolCallId
├─ history        the windowed history as sent — parts sized (text, tool_call, tool_call_response, compaction), never quoted
├─ toolset        the tool definitions as the model received them (description + JSON schema)
├─ modelCalls     one per provider request: attempt × step · usage · request outline (blockIds · historyCount · toolResultIds · toolsOffered) · response outline
├─ toolExecutions one per tool execute: input · model-facing output (post-compaction, ≤ 8 KB) · status · duration · compaction ref
├─ attempts       the provider rotation: started | ok | rotated | failed | cancelled, with the error kind
├─ citations      { itemId, source, match: path | quote | provider_source | unsurfaced }
├─ proposalId     the proposal a deskbot turn stopped on (read side: `proposal`, resolved by id — see Reading)
└─ createdAt · bodies (inline | persisted | redacted)
```

**Five item states** on every grounding item: `available` (the profile manifest's inventory —
never a trace item) → `considered` (retrieved or ranked this turn) → `included` (in a model
call's request) → `executed` (a tool execution returned it; `toolCallId` names which) → `cited`
(the answer names its path or quotes it). Inclusion never claims influence. An item the prompt
left out says why: `below_cutoff` (ranked past the top-N) or `size_cap` (cut by the block's size
cap). An `unsurfaced` citation is a project path the answer named that nothing this turn
produced — the answer's claim, not the turn's.

**A chunk's place** (2026-09-13). Tier 1 returns each hit with its `parentId`, `level`
(`section` · `paragraph`), `position`, `contentHash` and the document's `sourceUri`
(`retrieval/tiers/contextual.ts`); `chunkPlace()` (`ai/capabilities/chunk-place.ts`) records
them on the item together with the `retriever` that produced it, and the source records the
`retrievers` that ran. The read route resolves a recorded `parentId` to the parent **as it
stands now** (`parent`: level, position, size) — current metadata, labelled so, never the turn's
own account; a parent that is gone leaves it absent. The tiers the kernel has not taught yet
(parent-child, graph) record no place: the inspector says "not recorded".

**What each request carried.** `ModelCallRequest.toolResultIds` names the tool calls whose
results were in the request (the earlier steps' round trips, read from the prompt's
`tool-result` parts by the middleware). Absent on a call recorded before the field existed —
not recorded, which is what the graph then says — and empty when none. A tool-surfaced catalog
row or desk chunk carries the `toolCallId` of the execution that returned it (the sinks in
`profile.ts` take it from the tool's `execute` options).

`TurnTraceSnapshot` is the same shape with every key always present and the bodies withheld
(block text, tool I/O, tool definitions): what rides the wire as `message.metadata.trace`. The
client deep-merges metadata objects and replaces arrays, so a key that vanished would linger —
hence "always all keys". `TurnSummary` is what a conversation's turn list carries so a reloaded
thread renders its citation chips without the full trace.

## Recording

One author: `src/lib/server/ai/trace/recorder.ts` (`createTurnRecorder`). Each part of the
turn reports what only it sees; the recorder folds it into one trace.

| Who | Reports | Recorder call |
|---|---|---|
| Orchestrator, before the branches | the windowed history outline | `history()` |
| Tier 1 (`searchContextual`), through `chunkPlace()` | each candidate's parent, level, position, hash, path and retriever | inside `grounding()` |
| `composeTurn` (both surfaces, [profiles.md](./profiles.md)) | the awareness, every capability's verdict, every block with its text and its owning capability, every grounding source with its candidates and what the prompt took (per-lane timing), the tools mounted | `awareness()`, `activation()`, `block()`, `grounding()`, `timing()`, `toolsOffered()` |
| `trace/model-call-middleware.ts` (`wrapLanguageModel`) | each provider request as it leaves: system-prompt hash, history count, the tool results it carries (`toolResultIds`), tools **with schemas**, tool choice, provider options | `callStart()` |
| `onStepFinish` | usage (incl. cache reads), finish reason, response id/model, text size, tool calls, warnings | `callEnd()` |
| `onChunk` (first token) | ms to the call's first streamed token | `firstToken()` |
| `experimental_onToolCallFinish` + the desk step loop | input, model-facing output, status (incl. `requires_approval`), duration | `tool()` |
| `wrapToolsWithCompaction` | a result replaced by a ref (`resolve_ref` is the model's route back) | `compacted()` |
| `streamTextIntoOpenMessage` hooks | attempt start, rotation, final failure, cancellation | `attemptStart()`, `attemptEnd()` |
| `afterText` → `composition.verify()` (both surfaces) | citations (the catalog's path check, unsurfaced paths included), tool-surfaced grounding — the catalog rows the chatbot's tools returned, the desk chunks `desk_search_knowledge` put in front of the deskbot (`desk` source) — as `executed` items naming their `toolCallId`; finalize timings, outcome | `citations()`, `grounding()`, `timing()`, `outcome()` |
| the desk approval boundary | the proposal's id, the `awaiting_decision` outcome | `proposal()`, `outcome()` |

The middleware and the step hook each open/close the same call record by order (one open call
at a time); when the middleware could not wrap the model (a gateway id, a v2 provider, a test
mock), `callEnd()` opens the record itself without the request outline. The hook names are the
SDK's; the recorder's are the lifecycle's, so the v7 renames touch the orchestrator's adapter
lines only.

`profileVersion` hashes the stable blocks' text and the tool definitions: identical across
turns of one profile, so together with `cacheReadTokens` it shows whether the prefix is being
cached.

## Streaming

`recorder.subscribe(flush)`: every change schedules one `message-metadata` frame per 16 ms
burst (`METADATA_FLUSH_MS`), carrying `{ trace: recorder.snapshot() }` — plus `harness` (the
PlanCard) on the deskbot. Nothing else rides beside the trace.
Explicit drains keep the order exact: before the first model frame, before `finish`. Nothing is
written once the message is closed (`closed`), so no frame ever lands after `finish` or after an
error frame — that would open a second, empty message on the client.

Client consumers (`composites/chatbot/turn-progress.ts`): `turnProgress()` reads the status
row's stage from the snapshot (retrieving → catalog → generating); `citedCatalogSources()`
turns cited catalog items into `CitationChip`s; `turnFinished()` says when the snapshot's last
attempt has ended — the moment the showcase can open the turn from its persisted row.

## Persistence

Written **once**, in one transaction (`saveTurnTrace`), inside `afterText` after the answer
row is backfilled and before `finish`; a turn that ended on an error frame is written from the
stream's `onError`. Insert-only: a jsonb column updated per step would rewrite its whole TOAST
value each time.

| Table | One row per | Holds |
|---|---|---|
| `ai.turn` | assistant message (PK = `message_id`) | everything above except the calls and executions; `user_id` denormalized so the read route checks one column |
| `ai.model_call` (was `conversation_step`) | provider request (attempt × step) | usage, provider/model, duration, `request` and `response` outlines, `outcome` |
| `ai.tool_call` | tool execution | `tool_call_id` (the SDK's), `model_call_id`, ordinal, args, model-facing result, status, duration, compaction |

`ai.message.parts` stores the assistant message's parts (tool parts included, rebuilt from the
trace) so a reloaded thread renders the tool rows the answer was built on. The dead
`conversation_step.retrieval_events` and `message.context` columns are gone. Conversation
totals are summed from `model_call`.

Retention (`retention/schedule.ts`, `jobs/ai-telemetry-retention.ts`), the `mcp.call_log`
pattern: **redact** the bodies at 30 days (`ai-turn-bodies`: `turn.blocks`, `turn.history`,
`turn.toolset`, `model_call.request`, `tool_call.result`; `redacted_at` stamped), **delete** the
rows at 180 days (`ai-turns`, `ai-model-calls`, `ai-tool-calls`). Conversation delete cascades;
user delete cascades through the conversation. The privacy report counts turns.

## Reading

| Route | Answers | Guard |
|---|---|---|
| `GET /api/ai/conversations/[id]` | messages (with `parts`) + `turns[]` summaries | owner |
| `GET /api/ai/conversations/[id]/turns/[messageId]` | the full `TurnTrace`, grounding bodies resolved by id for `[SYSTEM_DOCS_USER_ID, viewer]`, `drifted` when a body's live hash differs from the recorded one, a recorded `parentId` resolved to the parent as it stands now (`parent`), `bodies: 'redacted'` after the redact pass; a deskbot turn's `proposal` resolved by `proposalId` (`resolveTurnProposal`: the card's steps derived from the tool as the PlanCard's were, the frozen scopes, the lifecycle status as it stands now, the receipts of what the approval ran — a proposal that names another message is left unresolved) | owner (the turn row's `user_id` AND the path's conversation; a miss on either is 404) |

The turn records the proposal's id only: the row keeps moving after the turn (approved →
executing → executed | failed, or rejected, or expired), so the trace shows where it stands
when read, next to the `awaiting_decision` outcome the turn ended on.

The owner sees their own turn entirely: prompt bodies, desk context, tool I/O, the chunk text
they were shown. The dev/admin gate on prompt text is gone (decision D1). Provider internals
(keys, raw errors) are never recorded.

## The turn inspector (Phases 3 and 5) and the turn graph (2026-09-13)

`/showcases/ai/chatbot#orchestration` and `/showcases/ai/deskbot#orchestration` open ONE turn
of their surface — a committed fixture signed-out, any of the viewer's own turns signed in —
and render it three ways over one selection: the **turn graph**, the **tree** (the accessible
alternative) and the **timing** waterfall. Selecting anywhere opens the same detail pane, which
takes space only while something is selected. The turn line above them names the question,
the outcome, the calls, the tools, the citations and the provider.

### The turn graph

Three fixed columns (`$lib/showcases/ai/turn-graph.ts`, the pure projection; its geometry in
`turn-graph-layout.ts`; rendered by `_components/turn-graph/*` through the shared `FlowDiagram`
wrapper on a desktop canvas and as three stacked lists under 768 px):

| Column | Cards, top to bottom |
|---|---|
| **Sources** | one per grounding source; expanded: its documents → a section (the parent chunk, read-side current metadata) → the chunks; the omitted candidates folded into one row |
| **Context and model calls** | the system prompt (one card; expanded: every block as a one-line row in cache order, the stable/per-request boundary a divider between them), the conversation and question, one card per model call, the answer (or the proposal a deskbot turn stopped on) |
| **Tools** | the inventory — declared · offered · called as counts, a badge on every row that ran, failed or was not offered — then one card per tool execution |

Every edge is a **recorded relation**; the graph never infers one. `containment` is where a
record sits; the data-flow kinds are `inclusion` (item → block, by `blockId`), `request`
(block → call by `request.blockIds`; the history → every call whose request counted messages;
the last `ok` call → the answer), `execution` (call → tool execution, by `modelCallId`),
`result` (execution → a later call only when that call's `toolResultIds` names it; execution
→ an item only when the item's `toolCallId` does) and `citation` (answer → item, for a
citation that resolved; an `unsurfaced` citation is a count on the answer card, never an
edge). A fact the record does not carry renders as "not recorded" (`flags.unknown`). Folding
lifts an edge onto the nearest visible ancestor and merges what coincides (`×n`). The
model-call selector marks what the chosen request was made of and which tools it offered;
declared, offered and called stay separate facts.

**Geometry is a pure function of the visible graph** (`layoutTurnGraph`, `routeEdges`) —
fixed sizes per kind and variant, columns at fixed x, nothing measured, so a test asserts it:

- A node with visible members is a **group**: a header row and its members stacked inside,
  each depth stepping in by the group's padding and tinted deeper (Source › Document › Section
  › Chunk; System prompt › Block). The nesting *is* the containment — a containment edge is
  never drawn on the canvas; the list writes nothing for it either.
- No edge crosses a card. Between adjacent columns an edge takes a **track** in the gutter
  (its one vertical run; runs that overlap in y take different tracks, 8 px apart). Inside a
  column an edge runs down that column's **rail** (a shared line just left of it, read as a
  bus with taps — the prompt and the history into every call, the last call into the answer).
  Two columns apart (a tool's result surfacing an item) an edge takes a **detour** beneath
  the columns. Data flow carries an arrowhead; containment is a box in a box; the legend
  under the canvas stays in view.
- Expanding never refits: the canvas grows with the graph (to 88 vh) and the zoom stays where
  the reader had it. A detail pane opening or closing refits to the highlighted subgraph, never
  below a readable floor (0.8). **Fit everything** is the reader's own button on the canvas,
  and the only fit allowed below that floor. Every node carries its size as `measured`: the
  flow counts a node initialized only once measured, and a node object the parent replaced
  would otherwise wait for a resize that never comes, leaving every queued fit unresolved.

On the chatbot page the inspector **follows** the thread above it (`TurnInspectorState.follow`):
a running turn is on the page from its streamed snapshot (`inspectedFromSnapshot`, bodies
pending), a finished one — or a resumed thread's last turn, which carries only its summary —
is read from its persisted trace (a 404 is read again briefly: the row lands before the
`finish` frame, but the client is not made to depend on it). A turn picked by hand, or opened
from an "Inspect this turn" link, switches following off until the viewer asks for it again.
A live turn that is loading, failed or not picked shows exactly that; the fixture never stands
in for it. `profileDrifted()` compares the recorded identity, guidance and tool definitions
with today's profile fact by fact — the two version hashes are built from different inputs
and never agree.

The tree walks the five states in commitment order:

| Group | Source | Nodes |
|---|---|---|
| **Available** | `GET /api/ai/profiles/[surface]` (a fixture carries its own copy) | identity · every capability with its activation verdict and its tool definitions (description + JSON schema) · the grounding inventories |
| **Awareness** | `trace.awareness` | locale, ceiling; chatbot: the page the question was asked from; deskbot: the granted scopes, the workspace, the panel layout, the panels handed to the prompt with their sizes |
| **Considered** | `trace.grounding` | every candidate per lane with its state chip, score, rank, the cut it fell to; a lane that did not run says why (deskbot: the `desk` chunks `desk_search_knowledge` surfaced, or `scope_off`) |
| **Prompt** | `trace.blocks`, `trace.history` | every block with its text — `<desk-context>` included (the tape in `#prompt` reads the same list); the history outline |
| **Model calls** | `trace.modelCalls`, `trace.toolExecutions`, `trace.attempts` | request outline, usage, cache reads, finish reason; tool input and model-facing output (a gated tool's `requiresApproval` sentinel shows as `requires_approval`); the rotation |
| **Proposal** (deskbot only) | `trace.proposal` | the plan the turn stopped on — status, risk tier, frozen scopes, expiry, approval and execution times — with one child per planned step: tool, risk, recovery, reviewed target, and its receipt (`ok` · `failed` · `conflict` with the replay's output, or "not run") |
| **Cited** | `trace.citations` | the deterministic string facts, each resolved to its item |

Every node opens content, never a count. The spine (`#spine`), the guard chain, the prompt
tape and the deskbot's approval lifecycle all render the same trace — `spineOf()` derives the
band statuses from the recorded facts (the deskbot's gate band is the door: `skipped` when
no proposal, `active` while pending, `not-taken` when the human rejected it or let it
expire, `done` otherwise); a trace exists only past the guard, so the guard chain of a turn
that exists has passed. The projection is pure (`$lib/showcases/ai/inspector.ts`): the
fixtures, a live turn and the recording script share it.

**Sources.** `recorded`: `scripts/ai/record-turn-fixture.ts` reads a real dev turn through the
same owner-guarded routes the page uses — with the session cookie (`--cookie`), or from the
four responses saved out of a signed-in browser (`--from <dir>`; the cookie is httpOnly, so
the page's own fetches are the door that copies no secret) — renames every id with
`scrubTurn()` (`demo_*`; the leak gate refuses UUIDs, `createId` shapes and key shapes) and
writes the fixture module (`--surface deskbot --out …` for the deskbot's two). `authored`: the
hand-written stand-in a fixture is until a turn has persisted — its identity, guidance, tool
definitions and the composer's own blocks (catalog map and current page; permissions,
workspace, desk context and layout) are the profile's real texts; its ranking, timings, model
calls, plan and receipts are not, and the provenance strip says so. The deskbot page carries
two: the plan halt (proposed through `desk_propose_plan`, then approved and run — receipts and
all) and the sentinel denial (a gated tool refused before anyone was asked; the proposal is
still pending). `live`: the viewer's own turn, fetched by id — from the picker, from "Inspect
your latest Vely turn" on the chatbot page (its ids ride on the streamed snapshot), or from
the **"Inspect this turn"** link every finished answer carries in Vely and in the desk's chat
panel (`?conversation=…&turn=…#orchestration`; the owner-guarded routes decide what the ids
may show).

The probe (`POST /api/ai/context-probe`, `ContextProbe.svelte`, the galaxy) is gone: it was a
second run reporting ids and counts. The frame scrubber (`TracePlayer`, `reduceTurn`, the
`SurfaceReplay` frame fixtures) is gone from both pages (decision D4, then Phase 5): a
recorded turn is read, not replayed.

## What it closes

- P5 of the plan: the trace was ephemeral, partial and gated.
- Chatbot tool calls are persisted; reloaded threads show tool rows and citation chips.
- The fabricated `vectorHits`/`bm25Hits` split and the degraded `pipeline:chunks` event are gone
  with the `pipeline:*` events; the recorder is the only trace author.
- P3: the prompt tape reads a turn's recorded blocks; the `PROMPT_BLOCKS` mirror and its
  text-scan drift test are gone.
- P6: the showcase shows real turns — recorded, or the viewer's own — never a simulation.
- The docs candidate pool is recorded from the real turn (12 candidates, top 4 in the prompt),
  so "what ranked below the cutoff" no longer needs a second run.

## Not recorded

Citation `quote` matching (a verbatim span of a grounding body in the answer) has a place in
the contract and no producer yet; `provider_source` waits for a provider that returns
grounding metadata. The approval replay (`POST /api/ai/proposals/[id]/approve`) is a
separate request and leaves no model call — its account is the proposal's receipts. The
parent-child and graph tiers return no chunk place yet (`RankedChunk` leaves it absent), so a
deskbot turn's desk chunks carry no ancestry. A model call recorded before 2026-09-13 has no
`toolResultIds`: the graph draws no result edge into it and says so.
