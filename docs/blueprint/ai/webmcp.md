# WebMCP — client actions for the browser's own agent

**Maturity: experiment** (built on `claude/cloud/agentic-architecture`; no browser with WebMCP
was available to the session — the adapter is proven against a fake `modelContext` only).

## Problem

A browser agent that is not v10r's (Chrome's assistant, an extension) operates a page by
reading pixels and simulating clicks. WebMCP lets a page register named tools on
`document.modelContext` so such an agent can call them semantically. v10r already has the
contract such tools need: client actions (`agent-actions.md`) — declared input schema,
validation, a handler that reads the interface back, a bounded honest result.

## Decision

Publish existing contracts; add nothing. `exposeClientActionsToWebMcp(runner, contracts, {
consent, descriptions, risks?, grantedScopes?, shareObserved? })`
(`src/lib/client-actions/webmcp.ts`) registers each contract whose effective risk is `read`
or `view`, with its valibot schema converted to JSON Schema, and `execute` = `runner.run()`.

| Concern | Rule |
|---|---|
| Consent | Nothing is published unless the user switched it on for this page (`consent`); switching off disposes every registration (`no_consent`) |
| Risk precedence | `TOOL_MANIFEST` decides a catalogued action's risk (`webMcpRiskOf`). A page-local `risks` entry may restate or raise it; a lower one refuses the action (`risk_conflicts_with_catalogue`). Only actions the catalogue does not know take their risk from the page |
| Which actions | Only `read`/`view`; unknown risk or no description → refused (fail closed) |
| Scope | A catalogued action's `scope` must be in `grantedScopes` (`scope_not_granted`) — the same scopes the in-app assistant needs |
| Disclosure | The agent gets a result's `status`, `code` and `message`; its `observed` facts (what the screen shows) only for actions listed in `shareObserved` |
| Validation, timeout, read-back | The runner's — identical to the in-app agent |
| Annotations | `readOnlyHint` only for `read`; `untrustedContentHint: true` (results describe the user's screen); `consequentialHint: false` |
| Abuse | 30 calls per minute across all published actions (`WEBMCP_CALLS_PER_MINUTE`) |
| Lifetime | One `AbortSignal` per exposure; `dispose()` (idempotent) withdraws every tool, and a call that arrives afterwards is `unavailable / unpublished`. A second exposure of a name already published on the same `modelContext` is refused (`already_published`) until the first disposes |
| Cancellation | A call whose caller's signal is already aborted is `refused / cancelled` without running the handler; once running, the runner's timeout bounds it |
| Isolation | Call ids are `webmcp_<exposure>_<n>`, so two exposures (or two tabs' agents) never share a runner dedup entry |
| Availability | `'modelContext' in document` feature detection; no polyfill is shipped |

## When to use / when not

Use when an application already has bounded client actions and wants external browser
agents to operate the view without screen-scraping. Do not use it for anything that changes
stored data (that stays a server tool behind approval, whoever asks), and do not make a page
depend on it — the API is in a Chrome origin trial (149–156, shipping planned for 157).

## Alternatives

Vercel UI SDK's agent layer (`createAgent`, `registerTools` over WebMCP; beta, monitored);
the declarative form attributes (`toolname` on `<form>`) — useful for plain forms, but they
bypass the runner's read-back; a polyfill (`@w3c/webmcp-polyfill`) — tests only.

## Failure modes

No WebMCP → nothing published, page unchanged. A handler not mounted → `unavailable`.
A looping agent → `budget_exhausted`. A caller sending junk → `refused / invalid_input`.

## Validation

`src/lib/client-actions/webmcp.test.ts` (13): schema conversion, invalid input, destructive
action refused whatever its description says, missing risk/description, no WebMCP, dispose,
budget, a page lowering a catalogued risk, scope not granted, no consent, observed facts
withheld, double registration and late calls, pre-aborted calls, exposure isolation.

**Not verified:** a real browser agent through Chrome's origin trial. Headless Chromium has
no `document.modelContext`, and a mocked one is not evidence of interoperability. Wiring
onto the Desk waits for the Desk refactor.

## Upstream

`document.modelContext.registerTool({ name, description, inputSchema, annotations, execute },
{ signal })` as documented at developer.chrome.com (2026-11). The earlier
`navigator.modelContext` / `provideContext` shape is gone. Reassess when Chrome ships it,
TAG review concludes, or a second engine implements it — then the refactored Desk mounts it.
