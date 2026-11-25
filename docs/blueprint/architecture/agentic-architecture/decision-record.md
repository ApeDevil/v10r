# Agentic architecture — decision record

Decisions of the 2026-11-24 initiative. Each names the alternative it beat and what would
reverse it. Decisions about the MCP *server* stay in
[../mcp-evolution/decision-record.md](../mcp-evolution/decision-record.md) (D1–D10); D10 —
*official, maintained protocol implementations by default; custom protocol code needs a
demonstrated necessity* — governs every decision below.

## AA1 — One application architecture, many doors

**Decision.** No standard gets its own registry, orchestrator, permission system or trace.
Every protocol is an adapter that ends in an existing mechanism: tools in `TOOL_MANIFEST`,
runs in the one orchestrator, writes through the approval gate, results through the
untrusted-content boundary, evidence in the turn trace.

**Alternatives.** Adopting an agent framework (Mastra, LangGraph, ADK) as the new runtime
because it already speaks A2A/AG-UI/MCP. Rejected: each brings its own tool registry, memory,
approval and trace model; v10r would run two architectures and translate between them.

**Reverse when** a workload needs an execution model the AI SDK loop cannot express (a
long-lived multi-agent graph with its own persistence) — then the framework enters as an
external A2A peer first, not as the core.

## AA2 — Risk comes from the effect, never from the door

**Decision.** `ToolRisk` (`read` · `view` · `create` · `write` · `destructive`) and `ToolReach`
are assigned by v10r. An MCP `readOnlyHint`, an A2A skill tag, a WebMCP annotation, an A2UI
button or an AG-UI frontend-tool declaration is an *untrusted hint*: it may raise a risk
(`destructiveHint` → `destructive`), never lower one. The MCP spec says the same: "clients
MUST consider tool annotations to be untrusted unless they come from trusted servers."

**Held by** `mcp-client` gate test (no external tool below `write` unless operator-listed),
`webmcp.ts` (only `read`/`view` publishable), the generative-UI action type (view only),
`client-actions.gate.test.ts` (unchanged).

## AA3 — Consume MCP with the official client, not `@ai-sdk/mcp`

**Decision.** `@modelcontextprotocol/client` 2.4.0 — the same major as the server v10r
already runs — inside a framework-free domain. External tools are *projected* into catalogue
vocabulary (`mcp_<peer>_<tool>`, v10r risk, `reach: external`, `resultOrigin: user`).

**Alternatives.** `@ai-sdk/mcp` `createMCPClient`: convenient, converts to AI SDK tools, but
it is the AI SDK's own protocol implementation (no `@modelcontextprotocol/*` dependency) and
its v6 line stops at protocol 2025-11-25 — choosing it would mean a second, non-official MCP
implementation and an AI SDK v7 dependency for this one feature.

**Reverse when** `@ai-sdk/mcp` is built on the official SDK, or after the v7 upgrade if the
conversion helpers remove more code than the projection keeps.

## AA4 — Wired through one external-operations door (revised 2026-11-24, Phase III)

**Was.** The MCP and A2A clients were domains with tests and interop runs, not callable from a
turn, until an admin peer configuration, approval cards and a quota existed.

**Decision now.** Both are wired to the deskbot through `server/external-operations/`: an
operator peer directory (`/admin/ai/peers` for MCP, `A2A_DELEGATION_PEERS` for A2A), a
disclosure the user authorizes per call (separate from mutation risk; reads too), a persistent
atomic claim in `ai.agent_external_operation` with a dispatch marker and lease healing, no
automatic retry, `unknown` kept as `unknown`. The deskbot because it is the authenticated
surface with the persisted proposal door; the chatbot stays read-only. Quota: the delegation
budget (1 per turn, 3 per conversation, depth 1) and the MCP byte caps.

**Reverse when** a surface other than the deskbot needs external calls (then: the same door),
or OAuth peers are wanted (a separate extension).

## AA5 — A2A as an adapter over deterministic architecture checks

**Decision.** v10r serves one A2A agent — the architecture review specialist — whose skills
run `checkSecurity` / `checkArchitecture` (Architecture Studio's engine) over a submitted
model. No model call, no quota, no state beyond the request. The client delegates to
allowlisted peers and types every answer as a **claim** (`status: 'claimed'`), validated and
bounded, never as verified evidence.

**Alternatives.** (a) Expose the chatbot as an A2A agent: every task would spend provider
quota on behalf of anonymous callers and re-open prompt-injection surfaces; rejected for
now. (b) Agents-as-tools inside one runtime: simpler, and still the right choice *inside*
v10r; A2A is for agents another team, language or framework owns. (c) Direct REST between
services: right when both ends are yours and the contract is fixed (`external-service.md`).

**Interop evidence.** An independently implemented Python `a2a-sdk` agent (a performance
specialist with its own rules) is called by v10r's JS client, and a Python client calls v10r's
server — both directions, two languages, two SDKs. The JS server uses `InMemoryTaskStore`
only because no task outlives its request.

**Reverse when** a task must outlive a request (then a database `TaskStore` and durable
execution, AA11) or a caller needs authenticated skills (then a security scheme on the card).

## AA6 — Generative UI: A2UI v1.0, Express for the model, a v10r catalog for the renderer

**Decision.** Three roles, decided separately by measurement (bench report in
[generative-ui.md](../../ai/generative-ui.md)):

| Role | Choice | Why |
|---|---|---|
| Model-output language | A2UI **Express**, compiled server-side to v1.0 messages | ~half the tokens of A2UI JSON (131 vs 252 on the reference UI), official compiler, streams |
| Internal renderer | Thin Svelte 5 adapter over the **lit-free root of `@a2ui/web_core`**, a v10r catalog mapped onto `#lib/components`, lazy-loaded | Official processor; component-first and token rules hold; never imports the Lit catalog |
| Interop protocol | **A2UI v1.0** | The only cross-vendor protocol of the three |

The prior research's stop condition ("park it if `web_core` needs a UI framework at run
time") was tested and **not triggered**: the root entry bundles with zero Lit bytes; only
`./universal` and `./catalogs/basic/v1` import Lit, and v10r imports neither (gate test).

**Alternatives.** json-render (official Svelte 5 renderer, ~4 KB gzip core): far lighter, but
no A2UI interop beyond a v0.8 docs recipe — choosing it internally would force custom A2UI
translation code. Kept as the measured fallback. OpenUI Lang: fewest tokens (103) but its
Svelte binding lags two majors and its package runs install-time telemetry — rejected.
Tool-driven cards: remain the baseline and the right choice when the shape is known.

**Reverse when** the lazy chunk becomes a problem on the chat route, or `web_core` breaks its
lit-free root.

## AA7 — Agent Skills are generated, never written

**Decision.** `skills/` is a generated surface of the pattern registry (`skills:build`,
`skills:check` in `validate`), spec-valid per agentskills.io. The registry stays the one
source; docs pages, MCP tools, the RAG corpus and skills are projections of it.

**Alternatives.** Hand-written skills (a second body of knowledge that drifts); serving them
through the MCP skills extension (SEP-2640 is Final, but the SDK support is "being
implemented") — deferred, not rejected.

## AA8 — AG-UI is a projection of the stream we already send

**Decision.** `createAgUiProjector` maps AI SDK UI message chunks to AG-UI events, checked
against `@ag-ui/core`'s own schemas. A client action is AG-UI's frontend tool unchanged.
`POST /api/ai/ag-ui/deskbot` is the adapter: it maps a `RunAgentInput` onto the deskbot's own
request, runs the same orchestrator turn and pipes the projector into SSE under the
deny-by-default policy. The deskbot first, because its loop holds both semantics the
protocol must carry (client actions, the approval boundary). A client cannot fabricate what
it does not own: a server tool result replays only under the ticket the server issued it
with, `state` and `resume` are refused, and decisions go through the approve route.

**Alternatives.** Replacing the AI SDK transport with AG-UI (no Svelte client, no evidence of
benefit); CopilotKit (React-only); a `[surface]` route (the chatbot's boundary work —
page context, surface-action admission — has no AG-UI mapping yet); AG-UI interrupts for
approvals (the approve route already holds the state machine; a resume payload would be a
second door to it).

**Reverse when** a third-party AG-UI frontend needs the chatbot, client-owned state or
interrupt-shaped approvals.

## AA9 — WebMCP publishes client-action contracts, nothing else

**Decision.** `exposeClientActionsToWebMcp` registers existing contracts with
`document.modelContext` when it exists. Same validation, runner, timeouts and bounded
results; only `read`/`view` actions; 30 calls per minute; withdrawn on dispose. Not mounted
on the Desk (the Desk is being refactored) — the Lab page uses it with its own actions.

**Reverse when** Chrome ships WebMCP (157 planned): then the refactored Desk mounts it.

## AA10 — Vercel UI SDK: monitor, do not adopt

Beta (0.1.0-beta.16), overlaps `#lib/components`; its agent layer (snapshot/act/query) is
documented only in secondary sources. Its idea — components that describe themselves to an
agent — is the same as client actions with a read-back. **Reverse at** 1.0 with a documented
AI SDK integration, and only as behaviours under existing components.

## AA11 — Durable execution: no runtime until a run must outlive a request

Every v10r turn finishes inside its request; the approval gate already persists a plan
across requests (proposal → approve → replay with receipts). MCP Tasks and A2A tasks are
protocol handles, not durability. **Adopt the Workflow SDK** (first-party SvelteKit plugin,
hooks for human approval, `WorkflowAgent` on AI SDK v7) **when** a concrete workload needs
minutes-long or restart-surviving runs — accepting the Vercel World lock-in, or Inngest if not.

## AA12 — OpenTelemetry: project the trace, add no tracer

`projectTurnTraceToGenAiSpans` turns a `TurnTrace` into `invoke_agent` / `chat` /
`execute_tool` spans with GenAI attribute names, `v10r.*` for v10r facts, and **no content,
by construction**. The trace remains the audit-grade record; telemetry is a lossy export.
An exporter (`@vercel/otel`, `instrumentation.server.ts`) is an operator choice.

## AA13 — AI SDK v7 is a prerequisite, on its own branch

GA since 2026-06-25 and where `WorkflowAgent`, `toolApproval`, `@ai-sdk/otel` and MCP Apps
helpers live; but `usage` semantics change (multi-step totals) and touch the trace's token
rows, the middleware moves to the V4 provider spec, and Svelte lacks the MCP Apps renderer.
Mixing that into protocol experiments would hide regressions. Planned as wave A′ in
[plan.md](./plan.md).

**Measured (2026-11-24, throwaway worktree, not committed):** bumping to `ai@7.0.170`,
`@ai-sdk/svelte@5.0.170` and the providers at major 4 gives **40 type errors in 5 files** —
11 in `chat-orchestrator.ts` (the tool-execution-end event lost `durationMs` / `success` /
`output` / `error`), 1 in `profile/manifest.ts` (a tool `description` may now be a function),
28 in three test files (`ToolExecutionOptions` gained a context) — and **1 of 766 AI tests
fails**: `model-call-middleware.test.ts`, the trace middleware's stream pass-through. The
trace is exactly where the upgrade bites, which is why it gets its own branch and a recorded
live turn.

**Built (2026-11-24, branch `claude/cloud/ai-sdk-v7`):** `ai` 7.0.179, `@ai-sdk/svelte`
5.0.179, `@ai-sdk/{google,groq,openai}` 4.x (the newest the 24 h install cooldown allows).
All 41 type errors fixed without an `any` or a compat shim; the trace keeps its meaning —
`onStepEnd`'s usage is one model call, the result's `usage` is the sum that is charged, and a
test pins both. Two behavioural changes needed code, not renames: the stateless
`toUIMessageStream` replaces the deprecated result method (with `redactToolErrors: true`
pinned), and an empty model stream now arrives as `NoOutputGeneratedError`, mapped back to the
rotating `EMPTY_ANSWER`. The browser chat client moves from the v5 line (`@ai-sdk/svelte` 3
carried its own `ai@5`) to the server's v7 — one `ai` copy. `toolApproval`, the MCP Apps
helpers, harness skills, `WorkflowAgent` and `@ai-sdk/otel` were read and **not adopted**: none
replaces the proposal → approve → receipt → revert gate, and `@ai-sdk/mcp` 2.x is still its own
protocol code (D10). What cannot be proven without a provider key is one chatbot turn and one
approved deskbot write per provider. Record: [../../ai/ai-sdk-v7.md](../../ai/ai-sdk-v7.md).

## AA14 — Deferred and rejected, with triggers

| Technology | Decision | Trigger to revisit |
|---|---|---|
| MCP Apps provider | Experiment (built on a branch: pattern explorer, [mcp-apps.md](../../ai/mcp-apps.md)) | A recorded external-host run; the compat kit run with a `_meta.ui` case |
| MCP Apps host | Defer | A sandbox origin and a concrete third-party app |
| ACP | Defer (future pattern) | Remote transport leaves RFD; Studio "hand to a coding agent" is scheduled |
| AGNTCY, ANP, registries | Monitor | A partner requires DID/VC identity or a registry reaches GA |
| CopilotKit, OpenUI, code-generated UI | Reject | Svelte support; telemetry removed; a separate sandbox architecture |
| Temporal, Trigger.dev | Reject for now | AA11's trigger with a non-Vercel requirement |
