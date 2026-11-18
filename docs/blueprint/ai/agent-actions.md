# Agent actions

How one assistant turn acts on both sides of the wire — server tools on stored data, client
actions on the interface in front of the user — through one contract, one catalogue and one
orchestrator. This file is the decision record and the pattern; the code is the contract.

## Agent action architecture

**Problem.** The deskbot could read and change the user's files, but it could not touch the
workspace the user is looking at. "Open my architecture document on the right" needs a server
read (find the file, as this user) and then an operation that only exists in the browser (a
panel in a dock). The obvious additions — a second registry for "UI actions", a channel that
pushes commands to browsers, a store of pending requests — each duplicate something the turn
already has, and each is a new place where an agent can claim work it did not do or reach a
write it was never approved for.

**Method.** An *agent action* is anything the model may ask the application to do. All of them
are entries of the one tool catalogue, `TOOL_MANIFEST` (`#lib/types/ai-tools.ts`); what differs
is declared per entry, on two independent axes:

| Axis | Values | Decides |
|---|---|---|
| `risk` — what it changes | `read` · `view` · `create` · `write` · `destructive` | Whether a human approves first (`requiresApproval(risk)`: write and destructive) |
| `executor` — where it runs | `server` · `client` | Who produces the result, and therefore how far the result is believed |

A **client action** is a tool with `executor: 'client'`. It has no server `execute`. The model
calls it like any tool; the call travels in the turn's own response stream to the browser that
sent the turn; a registered handler there validates the input, acts, reads the interface back
and answers with a bounded `ClientActionResult`; the browser sends the thread back and the same
turn continues. `view` is the risk that makes this safe to run unattended: it changes what is
shown, never what is stored.

```
user message ──► POST /api/ai/deskbot ──► composeTurn (tools = server ∪ advertised client actions)
                                            │
                     model step 1: desk_search_files  (server executes, result in stream)
                     model step 2: desk_open_file     (no execute — the call is streamed)
                                            ▼
browser: runner.run(call) ─ validate ─ handler ─ read the dock back ─► ClientActionResult
        addToolOutput(result) ─► same thread, POST /api/ai/deskbot again
                                            ▼
server: readClientActionResults ─ record on the trace ─ model step 3: the answer
```

Three states are kept apart, because merging them is how an agent reports work it never did:
**requested** (the call left the server), **executed** (a handler ran), **confirmed** (the
handler observed the intended state afterwards). Only `completed` means all three; `failed`,
`unavailable`, `refused` and `timed_out` each name the one that is missing.

## Component responsibilities

| Piece | Where | Owns |
|---|---|---|
| Catalogue | `#lib/types/ai-tools.ts` | Every action's name, risk, executor, scope, capability, result origin, reach |
| Client action contract | `#lib/client-actions/contract.ts` | `ClientActionContract` (name, input schema, timeout) and the bounded `ClientActionResult`. No framework, no SDK |
| Runner | `#lib/client-actions/runner.ts` | Registration with unmount, `available()`, and `run()`: unknown name, invalid input, missing handler, timeout, thrown handler, malformed result, duplicate call id. Never throws |
| The Desk's actions | `#lib/desk/arrange-actions.ts` | `desk_open_file`, `desk_focus_panel`, `desk_close_panel`: one declaration both sides read; the per-turn budget |
| Svelte adapter | `components/desk/arrange-action-handlers.ts` | The handlers: precondition against the live dock, act through the verbs a human gesture uses, read back, report |
| Server tools | `server/ai/tools/desk-arrange.ts` | The model-facing tools, derived from the same contracts, with no `execute` |
| Capability | `server/ai/capabilities/desk-arrange.ts` | When the actions are offered: scope granted, handler advertised, budget left; the guidance |
| Result reader | `server/ai/client-action-results.ts` | The one door a browser-produced result comes through before a model sees it |
| Session | `components/desk/panels/bot/desk-bot-session.svelte.ts` | Runs a call once, writes the result into the thread, decides whether the thread goes back |

## Decision record

**1. What it means here.** One way for the assistant to discover, understand, be authorized for
and coordinate application actions — not one way to implement them. A server tool and a client
action share a catalogue entry shape, a scope, a capability, a label, a trace record and a place
in the profile manifest; they do not share an execution mechanism, and should not.

**2. What already satisfied the requirement.**

| Requirement | Already there |
|---|---|
| Action catalogue with metadata | `TOOL_MANIFEST`, client-safe, read by the server, the UI and the admin pages |
| Discovery per turn | `AssistantProfile` → `AssistantCapability.activates` → `composeTurn`; the profile manifest |
| Authorization | Session auth in `guardAiRequest`; consent scopes (`DeskToolScope`); owner-scoped domain functions |
| Approval | `requiresApproval(risk)` → proposal → approve route → `executeDeskToolCall` → receipts → revert |
| Orchestration | One `chat-orchestrator.ts`, a multi-step agent loop, deadlines, fallback rotation |
| Evidence | The turn trace: every tool execution with its model-facing result |
| Untrusted results | `resultOrigin` / `reach`, `<untrusted-content>` wrapping in the turn and on replay |
| Server → UI consequences | `DeskEffect`: a server tool's result names what the desk should refresh or open |

**3. The gaps.** (a) No way for the model to *ask* the interface for something and learn whether
it happened — a `DeskEffect` is fire-and-forget and server-derived. (b) No risk tier for "changes
the view, not the data". (c) No notion of availability that depends on what is mounted in the
browser. (d) No reading of a tool result the server did not produce.

**4. Alternatives considered.**

| Alternative | Why not |
|---|---|
| Server-held pending-action registry + a push channel (SSE) and a result endpoint | Needs cross-instance state and a session-routing table on a serverless deployment, plus a second transport and a second correlation scheme — for a result the open response stream already delivers to exactly the right browser |
| Extend `DeskEffect` with acknowledgements | Effects are consequences of a server tool, decided by the server. Giving them requests and results would make one name mean two things and still need the round trip |
| A separate frontend action registry beside the manifest | Two catalogues to keep in step, two permission surfaces, two sets of labels and trace records |
| Adopt the Vercel UI SDK agent runtime, or WebMCP | UI SDK was in beta and WebMCP in origin trial at decision time (2026-11); neither is consumed by the agent this app runs. Both map onto this contract as optional adapters — see [emulation](#emulating-it-elsewhere) |
| A workflow engine for cross-surface plans | The agent loop already orders steps and carries results; a client action adds one request boundary, not a new control structure |
| Generic commands (`click`, `eval`, a selector) | An unbounded action is not an action catalogue. Never accepted |

**5. Why this one.** It adds one field, one risk value, one scope and one capability to systems
that already exist, and one small framework-free module. The response stream of the turn is
already an authenticated, per-request channel to the one browser that asked; using it means
there is no session registry to get wrong, nothing to clean up when a tab closes, and no way
for a call to reach another user's browser. The AI SDK already supports tools without
`execute` — no dependency was added.

**6. How it avoids duplication.** Client actions are manifest entries, so the scope toggle, the
tool label, the admin tool matrix, the topology view, the profile manifest and the trace picked
them up from the catalogue. The action's input schema is declared once and read by the server
(model-facing schema) and the browser (validation before the handler). The handlers call the
same dock verbs as a click. There is no second orchestrator, permission system or execution
engine.

**7. Security, approvals and execution boundaries.**

- A client action can never change stored data. `client-actions.gate.test.ts` fails if a
  client-executed tool carries a risk an approval is owed for, appears among the tools the
  approval door replays, or lacks a contract; and if any server tool lacks an `execute`.
- Every write still goes through the approval gate, on the server, against the reviewed
  baseline. A client action result is never an input to an authorization decision: the only
  thing the server branches on is the action budget.
- A result is the user's browser describing the user's screen. It is declared
  `resultOrigin: 'user'`, read through the contract (anything else becomes
  `malformed_result`), bounded in size and shape, and wrapped as untrusted content for the
  model like every other user-origin result.
- The model supplies a file *id* only. The handler fetches the file's name and type from the
  owner-scoped route as the signed-in user, so an id the model was tricked into naming opens
  nothing that user could not open by hand.
- The agent gets less than the user: it cannot close the conversation it is speaking through,
  a panel that is not closable, or a panel with unsaved work.
- The client advertises which actions have a handler mounted *now* (`clientActions`, pinned to
  the declared names by the request schema); the server offers only advertised ∩ declared.
  Advertising is a consent-level fact, like the scopes: asserting it buys nothing, because the
  action still only runs in that same browser.
- Six client actions per user turn (`DESK_ARRANGE_MAX_ACTIONS_PER_TURN`); past it the
  capability deactivates and the model has to answer.

**8. Emulation.** See [Emulating it elsewhere](#emulating-it-elsewhere).

## Cross-surface behaviour

| Concern | What happens |
|---|---|
| Ordering and dependencies | The agent loop: the model reads a server result before it names a file id in a client action. No plan structure is added |
| Result propagation | The browser writes the result into the call's part; the continuation request carries the thread; `readClientActionResults` hands the last step's results to the orchestrator |
| Partial failure | A failed action is a result like any other; the model reports it. Earlier server work is not undone — reads have nothing to undo, writes were never run without approval |
| Cancellation | Stop aborts the stream. An action already running settles into the thread and the I/O log, and starts no new request |
| Retries and duplicates | The runner remembers call ids: a call delivered twice runs once. The session sends one continuation per settled step |
| Human approval | Unchanged. A turn that stops at the approval boundary is not continued by the client; only a step this session just settled is |
| Stale or closed browser | Unanswered calls are dropped from the history on the next request — no result, so nothing is claimed. A panel mid-remount gets 1.5 s for its handler to come back before the call is `unavailable` |
| Browser/server synchronisation | A continuation re-reads the desk (`turnBody()`), so the model sees the workspace the action left behind |
| Recovery | View changes need no compensation: the user closes the panel. Data changes keep the proposal's revert |

## Invariants

- Every agent action is a `TOOL_MANIFEST` entry with a declared `risk` and `executor`.
- A client-executed tool has risk `read` or `view`, no server `execute`, a declared contract,
  `resultOrigin: 'user'` and `reach: 'internal'`; it is never replayable by the approval door.
- A client action is offered only when its scope is granted, its handler is advertised by the
  requesting browser, and the turn's action budget is not spent.
- A handler answers `completed` only for a state it observed after acting.
- No client action result reaches a model unless it parsed as a `ClientActionResult`.
- The thread goes back to the server on its own only for a client action this session settled
  live — never for a step that ended on a server tool.
- Nothing accepts a script, a selector or a free-form command as an action.

## When to use it, and when not

Use a client action when the operation exists only in the interface (layout, focus, selection,
navigation, a viewport), the user could do it with a click, and undoing it is another click.

Do not use one for anything that changes stored data — make it a server tool so the approval
gate, the receipt and the revert apply. Do not use one when no user is watching (a job, an MCP
client): there is no browser to answer. Use a `DeskEffect` instead when the UI change is a
*consequence* of a server tool the model already called (refresh the file it just edited) and
the model does not need to know whether it happened.

## Emulating it elsewhere

1. Add `executor` to your tool catalogue and a risk tier for view-only changes. Gate the one
   forbidden combination — client-executed and data-changing — in a test.
2. Declare each client action once: name, input schema, timeout. Keep framework words out of
   the public input (files, panels, placements — not component refs or store keys).
3. Give the client a runner that never throws and always answers, and handlers that read back
   before they say `completed`.
4. Deliver calls on a channel that already ends in the right browser. With the AI SDK that is a
   tool without `execute`, `onToolCall`, `addToolOutput` and a `sendAutomaticallyWhen` you
   write yourself — the stock predicate also fires on steps that ended on a server tool.
5. On the server, read results through the contract before the model sees them, record them,
   and never branch an authorization on one.
6. Bound the round trips per user turn.

The contract does not depend on Svelte, the AI SDK, or a provider. A React adapter is another
set of handlers on the same runner. `document.modelContext.registerTool` (WebMCP) or a UI SDK
`createAgent` action list can be generated from the same contracts when an external agent
should see them; neither is needed for the in-app assistant, and neither is wired here.

## What is not claimed

- No live model run was recorded for this pattern in the session that built it (the cloud
  environment has no database or provider key). The proof is the unit and gate lanes listed
  below; the registry grades it `implemented`, not `proven`, until a browser-verified turn is.
- A turn with client actions spans two requests, so it is stored as two assistant rows and two
  traces: the first holds the server tools of the first request, the second the settled action
  and the answer. The thread shows one message; the inspector opens the latest trace.
- When the dock is already at its maximum depth, `placement: "right"` opens the file as a tab
  in the right-most pane rather than a new one, and reports `placed: "tab"`.
- Whether a model respects a non-`completed` status is guidance, not a guarantee; what the
  UI shows and what the trace records do not depend on it.

## Proof surface

| Concern | Test |
|---|---|
| Unknown action, invalid input, missing handler, timeout, thrown handler, malformed result, duplicates | `src/lib/client-actions/runner.test.ts` |
| Real dock: open / focus / close, refusals, read-back, another user's file id | `src/lib/components/desk/arrange-action-handlers.test.ts` |
| Executor × risk, approval door, `execute` presence, advertised names | `src/lib/server/ai/client-actions.gate.test.ts` |
| Forged, malformed, unanswered and errored results; budget count | `src/lib/server/ai/client-action-results.test.ts` |
| Continuation keeps the message id, records the result, budget, scope off, nothing advertised | `src/lib/server/ai/chat-orchestrator.test.ts` |
| Run once, continue once, never at the approval boundary, Stop, new chat, the cross-surface turn | `src/lib/components/desk/panels/bot/desk-bot-session.svelte.test.ts` |

Related: [surfaces.md](./surfaces.md) (the one door for mutations),
[untrusted-content.md](./untrusted-content.md) (result origin), [profiles.md](./profiles.md)
(capabilities), [../desk/README.md](../desk/README.md) (desk effects).
