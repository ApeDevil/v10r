# Agent–user interaction — AG-UI as a projection of the turn stream

**Maturity: experiment, built.** `POST /api/ai/ag-ui/deskbot` serves the deskbot to AG-UI
clients; complete event sequences are verified by the official `@ag-ui/client` `HttpAgent`
against the real handler over HTTP with a mock model. No run against a real provider or a
third-party AG-UI frontend (CopilotKit, the dojo) is recorded yet.

## Problem

Frontends outside v10r (CopilotKit, the AG-UI dojo, framework clients for LangGraph, ADK,
Mastra, Pydantic AI) speak AG-UI: `RUN_*`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_*`,
`ACTIVITY_*`, `REASONING_*`, `CUSTOM`. v10r's own clients speak the AI SDK UI message stream.
Both describe the same agent loop.

## Decision

Keep the AI SDK transport; translate it at the edge. There is no second agent runtime, no
second orchestrator and no second tool registry: the AG-UI door maps a `RunAgentInput` onto
the request `POST /api/ai/deskbot` takes, runs the same `orchestrateChat` turn, and projects
its stream. Three modules in `src/lib/server/ai/ag-ui/`, one thin route:

| Module | Job |
|---|---|
| `ui-stream-to-ag-ui.ts` | `createAgUiProjector` — each `UIMessageChunk` to AG-UI events, under an export policy |
| `run-input.ts` | `readAgUiRunInput` — the trust boundary: `RunAgentInput` (official `RunAgentInputSchema`) → `DeskRequestSchema` |
| `serve-run.ts` | `serveAgUiRun` — reads the orchestrator's response, projects it, adds the endpoint's handles, frames SSE |
| `tool-result-ticket.ts` | Tickets that let the next run tell the server's own replayed tool result from a forged one |
| `routes/api/ai/ag-ui/deskbot/+server.ts` | Guard → bounded body → read input → orchestrate → serve |

| AI SDK chunk | AG-UI event |
|---|---|
| `start` / `finish` / `error` / `abort` | `RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR` / `RUN_ERROR` (`code: cancelled`) |
| `start-step` / `finish-step` | `STEP_STARTED` / `STEP_FINISHED` |
| `text-*` | `TEXT_MESSAGE_START` / `CONTENT` / `END` |
| `reasoning-*` | `REASONING_START`, `REASONING_MESSAGE_*`, `REASONING_END` |
| `tool-input-*` | `TOOL_CALL_START` / `ARGS` / `END` (args streamed once, never repeated) |
| `tool-output-*` | `TOOL_CALL_RESULT` (bounded to 8 000 chars) |
| `message-metadata`, `data-*` | `CUSTOM` named `v10r.*` |
| `source-*`, `file` | dropped and counted |

## The endpoint

`POST /api/ai/ag-ui/deskbot`, `Accept: text/event-stream`, body an AG-UI `RunAgentInput`.

**Why the deskbot, and only it.** It is the surface whose loop has the two semantics the
protocol has to carry — client actions (AG-UI's frontend tools) and the approval boundary.
The chatbot route does work at its own boundary (page-context resolution, surface-action
admission) that needs its own mapping before an AG-UI run can reach it; a `[surface]`
parameter would have advertised a door that does not exist.

**Same door as the deskbot route.** `guardAiRequest` (session → 401, provider availability →
503, the AI rate limit and daily budget → 429), `readJsonBounded(MAX_AI_BODY_BYTES)` (413),
the hook's CSRF check — `/api/ai/ag-ui/` is not exempt, so a client sends `X-Requested-With`
as a configured header and must be same-origin (`HttpAgent({ headers })`). Registered in
`authz-coverage.gate.test.ts` as an `ai`-guarded surface that may never be allowlisted.

**Framing.** One `data: <json>\n\n` per event — the SSE framing `@ag-ui/encoder` writes. The
encoder is not a runtime dependency because it pulls the protobuf transport with it.
`@ag-ui/core` is a runtime dependency (its zod schemas validate the input).

**Export policy.** The endpoint passes no policy: `AG_UI_DEFAULT_EXPORT_POLICY`, deny by
default (below). An operator-owned frontend that should see more gets a route of its own
with an explicit allowlist — never a request flag.

### Run input — what is admitted, what is refused

| `RunAgentInput` field | Treatment |
|---|---|
| `threadId`, `runId` | Echoed in `RUN_STARTED` / `RUN_FINISHED`. The server thread is a v10r conversation, named by `forwardedProps.conversationId`; a new one's id is announced as `CUSTOM v10r.thread` |
| `messages` — user | Text only (`string` or text parts); other content → 422 `unsupported_content` |
| `messages` — assistant | Text and tool calls; consecutive assistant messages form one assistant turn (the client splits one v10r message into a text message and a tool-call message) |
| `messages` — `tool` for a **client action** | The client's own answer: passed on and read through the client action contract (`client-action-results.ts`) — anything not a bounded `ClientActionResult` becomes `malformed_result` |
| `messages` — `tool` for a **server tool** | Admitted only when its `id` is the ticket the server exported it under, binding user, call id, tool name and the digests of the exported arguments and content. Otherwise → 422 `tool_result_refused`. An expired ticket is authentic but stale: the call is dropped |
| `messages` — orphaned or duplicated tool result | 422 `tool_result_refused` |
| `messages` — unanswered tool call | Dropped (nothing is known about it) |
| `messages` — system, developer, reasoning, activity | Dropped: the profile composes the instructions |
| `tools` | Only the surface's client actions (`executor: 'client'`, surface `deskbot`) are taken, as the `clientActions` advertisement; a name of a server tool → 422 `tool_refused`; anything else is ignored — never offered to the model, its schema never read |
| `state` | Must be empty → else 422 `state_refused` (see State) |
| `resume` | 422 `resume_refused`: decisions go through the approve route |
| `context` | 422 `context_refused`: desk context travels as `forwardedProps.panelContext` |
| `forwardedProps` | Only `conversationId`, `providerId`, `toolScopes`, `deskLayout`, `panelContext`, `activeWorkspace` — validated by `DeskRequestSchema`; any other key → 422 `forwarded_props_refused` |

A body that is not a `RunAgentInput` is 400 `invalid_run_input`; a mapped request
`DeskRequestSchema` rejects is 400 `validation_failed`. A refusal the orchestrator answers
before any stream exists (503 no provider, 404 unknown conversation, a database failure)
passes through as the JSON error it is. HTTP errors are pre-run: no run was started.

### Semantics

| Semantic | Events | How |
|---|---|---|
| Run start | `RUN_STARTED`, then `CUSTOM v10r.thread { conversationId }` | `start` chunk; the conversation id is the caller's own server thread |
| Text streaming | `TEXT_MESSAGE_START` / `CONTENT` / `END` inside `STEP_*` | Projected per chunk |
| Tool-call lifecycle | `TOOL_CALL_START` → (`ARGS` only if allowlisted) → `TOOL_CALL_END` | Projected; args withheld by default |
| Tool result | `TOOL_CALL_RESULT`, content `[withheld by the export policy]` unless allowlisted, `messageId` = ticket | `serve-run.ts` stamps the ticket |
| Run completion | `RUN_FINISHED` | `finish` chunk |
| Failure | `RUN_ERROR { message: 'The run failed.', code: 'run_failed' }` | Provider text never leaves (`errorDetail: false`); a stream that ends without a terminal chunk also ends here |
| Cancellation | `RUN_ERROR { code: 'cancelled' }`, never `RUN_FINISHED` | The client aborts → the request signal (Vercel) or the body cancel (Node bridge) → `http/cancellation.ts` aborts every model call; the orchestrator closes a cancelled message with `finish`, which the endpoint reports as cancelled |
| Client interaction | Run ends `TOOL_CALL_END` → `RUN_FINISHED` with no result | A client action has no server `execute`; the next run carries the result as a `tool` message — v10r's continuation |
| Approval | `TOOL_CALL_*`, `CUSTOM v10r.proposal { proposalId, status: 'pending' }`, `RUN_FINISHED` | The proposal is persisted server-side as on every deskbot turn; the handle carries no goal, step, argument or target |
| Approved continuation | — | The client reports the user's decision through `POST /api/ai/proposals/[id]/approve` (or `DELETE` to reject), which checks ownership, state and expiry and leaves the execution receipt message; the AG-UI client cannot approve inside a run: a forged tool result, a `state`, a `resume` or a `forwardedProps` claim is refused |

### State

`STATE_SNAPSHOT` / `STATE_DELTA` are not emitted, and a non-empty `RunAgentInput.state` is
refused. v10r has no client-owned agent state, and its server-authoritative state — a
proposal's status, the conversation — lives in the database behind its own routes
(`GET /api/ai/proposals/[id]`). Accepting a client state would make it a claim about that
state; emitting one would make the client a second copy of it. When a client-owned state is
needed it gets a namespace of its own that no server decision reads.

## When to use / when not

Use when an AG-UI client must talk to an existing AI SDK agent. Do not replace the AI SDK
stream for your own Svelte client: there is no official Svelte AG-UI client and no measured
benefit. Do not adopt CopilotKit in a Svelte app (React-only).

## Export policy

What an external frontend sees is an allowlist (`AgUiExportPolicy`), not whatever the
internal stream carries. `AG_UI_DEFAULT_EXPORT_POLICY` — the endpoint's policy — exports the
run frame, steps and the assistant's text, and withholds the rest:

| Internal content | Default | Allowlist |
|---|---|---|
| Reasoning | Omitted | `reasoning: 'include'` (an operator-owned frontend) |
| Tool arguments / results | Name and lifecycle only; result content is `[withheld by the export policy]` | `tools: { name: { input, output } }` |
| Message metadata (the turn trace, the proposal card) | Withheld | `metadataKeys` (`harness` for the card) |
| `data-*` parts | Withheld | `dataParts` |
| Errors | `RUN_ERROR` "The run failed." with code `run_failed`; tool errors generic | `errorDetail: true` |

Everything withheld is counted (`withheld()`), so a test or an operator can see what a
frontend did not get. The endpoint's own additions — the thread and proposal handles and the
result tickets — are identifiers the caller needs to continue, never content.

## Security

The projection executes nothing, and the AG-UI door adds no authority: the turn is the
deskbot's, with its scopes (a consent preference, as on the deskbot route), its approval
boundary and its trace. A write the model proposes is still a proposal; only the approve
route executes it. A tool declared by an AG-UI client is never accepted as a server tool. A
server tool result can come back into the model's history only as the exact text the server
exported, to the user it exported it to. Rotating `AG_UI_RESULT_TICKET_SECRET` (or the auth
secret it derives from) makes existing threads' echoed results unverifiable: their next run
is refused until the client starts a fresh thread.

## Validation

- `ui-stream-to-ag-ui.test.ts` — every projected event against `@ag-ui/core`'s `EventSchema`
  under an open and the default policy; the default policy pinned (no reasoning, arguments,
  results, trace, data parts or internal error text).
- `serve-run.test.ts` — the endpoint's additions on hand-written streams: handles, tickets,
  cancellation reported as `RUN_ERROR cancelled`, a truncated stream closed, the cancel door
  to the orchestrator's body.
- `tool-result-ticket.test.ts` — a ticket verifies only its own facts; expired ≠ forged.
- `routes/api/ai/ag-ui/deskbot/server.test.ts` — the real route, the real orchestrator and
  `streamText` over `MockLanguageModelV4`, behind a real `node:http` server, driven by
  `HttpAgent` (whose pipeline enforces and verifies every sequence), with each server
  sequence re-run through `verifyEvents` and asserted in order: a text run; a server tool
  lifecycle and its admitted echo; a client action run and its continuation; a malformed
  client result read through the contract; a provider failure with no provider text; a
  client abort that aborts the model call and ends `RUN_ERROR cancelled`; a forged and a
  tampered server tool result refused before any model call; the approval boundary's
  proposal handle with forged approvals (tool result, `state`, `forwardedProps`, `resume`)
  refused; only declared client actions taken from `tools`; 401 for an anonymous caller.

## Next step, if triggered

A recorded run against a real provider and a third-party AG-UI frontend (the dojo's generic
client, or CopilotKit through its HTTP agent), with the CSRF hook in the path. AG-UI's own
interrupts (`RUN_FINISHED` outcome `interrupt`, `resume`) could carry the approval card once a
consumer needs them — the decision would still be checked by the approve route's rules,
never taken from the resume payload.
