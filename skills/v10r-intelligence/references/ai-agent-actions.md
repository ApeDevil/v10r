# Agent actions

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Category:** AI · **Tier:** deep · **Maturity:** implemented · **Risk:** medium — a browser executes model-chosen operations; held to view-only changes by a gate test

Every action the assistant may take is one tool-catalogue entry with a risk (what it changes) and an executor (server or client). A client action has no server execute: the call streams to the browser that sent the turn, a registered handler validates it, acts, reads the interface back and answers a bounded result, and the same turn continues — so one turn can find a file on the server and open it in a panel, without a second registry, transport or orchestrator.

**When to use:** Use when an in-app assistant must operate live interface state (layout, focus, selection, navigation) as part of the same turn that reads or proposes changes to server data, and must report honestly whether the interface change happened.

**Needs:** required llm-provider, relational-db (via deskbot-approval-gate)

## Avoid when

- The operation changes stored data — make it a server tool so approval, receipts and undo apply; a browser's word must never stand in for a write
- No user is watching the turn (a job, an external MCP client) — there is no browser to execute or answer
- The UI change is only a consequence of a server tool the model already called and the model does not need the outcome — a fire-and-forget desk effect is enough

## Alternatives

- **Server-derived UI effects on tool results (desk-ai-effects)** — prefer when the server already knows what the UI should do after its own tool ran, and no result has to reach the model
- **A server-held pending-action queue with a push channel and a result endpoint** — prefer when actions must reach a browser other than the one that sent the turn, or outlive the request — and you can afford shared state across instances

## Docs

- `docs/blueprint/ai/agent-actions.md` — The pattern and its decision record: axes, flow, alternatives, invariants, emulation ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/agent-actions.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/agent-actions.md))
- `docs/blueprint/ai/untrusted-content.md` — Why a browser-produced result is user-origin content ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/untrusted-content.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/untrusted-content.md))

## Code

- `src/lib/types/ai-tools.ts` — TOOL_MANIFEST: executor and the view risk beside every other tool fact ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/types/ai-tools.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/types/ai-tools.ts))
- `src/lib/client-actions/contract.ts` — ClientActionContract and the bounded ClientActionResult — framework-free ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/client-actions/contract.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/client-actions/contract.ts))
- `src/lib/client-actions/runner.ts` — Register/unmount, available(), run(): always answers, never throws, runs a call id once ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/client-actions/runner.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/client-actions/runner.ts))
- `src/lib/desk/arrange-actions.ts` — The Desk's three declarations, read by server and browser; the per-turn budget ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/desk/arrange-actions.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/desk/arrange-actions.ts))
- `src/lib/components/desk/arrange-action-handlers.ts` — Svelte adapter: precondition, act through the user's verbs, read back, report ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/arrange-action-handlers.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/arrange-action-handlers.ts))
- `src/lib/server/ai/tools/desk-arrange.ts` — Model-facing tools derived from the contracts, with no execute ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/desk-arrange.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/desk-arrange.ts))
- `src/lib/server/ai/capabilities/desk-arrange.ts` — Offered only when scope granted, handler advertised, budget left ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/capabilities/desk-arrange.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/capabilities/desk-arrange.ts))
- `src/lib/server/ai/client-action-results.ts` — The door a browser-produced result is read through before a model sees it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/client-action-results.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/client-action-results.ts))
- `src/lib/components/desk/panels/bot/desk-bot-session.svelte.ts` — Runs a call once, writes the result into the thread, continues only for a step it settled ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/bot/desk-bot-session.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/bot/desk-bot-session.svelte.ts))

## Tests

- `src/lib/server/ai/client-actions.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/client-actions.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/client-actions.gate.test.ts))
- `src/lib/client-actions/runner.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/client-actions/runner.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/client-actions/runner.test.ts))
- `src/lib/components/desk/arrange-action-handlers.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/arrange-action-handlers.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/arrange-action-handlers.test.ts))
- `src/lib/server/ai/client-action-results.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/client-action-results.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/client-action-results.test.ts))
- `src/lib/server/ai/chat-orchestrator.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/chat-orchestrator.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/chat-orchestrator.test.ts))
- `src/lib/components/desk/panels/bot/desk-bot-session.svelte.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/bot/desk-bot-session.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/bot/desk-bot-session.svelte.test.ts))

## Invariants

- Every agent action is one catalogue entry declaring risk (what it changes) and executor (where it runs) separately; the forbidden combination — client-executed and data-changing — fails a gate test.
- A client-executed tool has no server execute, is never replayable by the approval door, and its result is user-origin content read through the contract before any model sees it.
- Requested, executed and confirmed are distinct: a handler answers completed only for a state it observed after acting, and a call nobody answered is dropped, never assumed.
- A client action is offered only when its scope is granted, the requesting browser advertises a mounted handler for it, and the turn's action budget is not spent.
- A client action result never authorizes anything; every change to stored data stays a server tool behind the approval gate.
- The client continues the turn on its own only for a client action it just settled — never for a step that ended on a server tool, so the approval boundary still waits for the user.
- No action accepts a script, a selector or a free-form command; the model names registered operations with schema-validated input.

## Emulation notes

- Do not build a second registry or a push channel first: the turn's own response stream already ends in the one browser that asked. With the AI SDK that is a tool without execute plus onToolCall and addToolOutput.
- Write your own sendAutomaticallyWhen. The stock 'last assistant message is complete with tool calls' predicate also fires on steps that ended on a server tool and would resend a turn waiting at an approval.
- On a continuation, start the stream with the client's existing assistant message id, or the SDK client appends a second bubble.
- Declare each action once (name, input schema, timeout) in a module neither side's framework appears in; derive the model-facing schema and the client-side validation from it.
- Let the model supply ids only; have the handler fetch names and types from an owner-scoped route as the signed-in user.
- Give the agent less than the user where a human would be asked first (unsaved work, the conversation's own panel).
- Bound client actions per user turn — each result starts another model request.
- WebMCP registerTool or a UI SDK action list can be generated from the same contracts for external agents; treat them as optional adapters, not as the architecture.

## Depends on

- [AI tool manifest and harness split](ai-tool-harness.md)
- [AI surfaces](ai-surfaces.md)
- [Deskbot approval gate](deskbot-approval-gate.md)
- [Untrusted-content boundary](ai-untrusted-content-boundary.md)

---

_Machine-readable record: `ai-agent-actions` in `pattern-library/registry.json`._
