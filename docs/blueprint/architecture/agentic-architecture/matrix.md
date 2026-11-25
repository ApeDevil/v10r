# Agentic technology matrix

The living record of [process.md](./process.md), extending the method of the
[MCP evolution matrix](../mcp-evolution/matrix.md) (which stays the deeper record for the MCP
*server*) to every agentic technology v10r considered. Versions and states are as read on
**2026-11-24** from the official specifications, repositories and `npm view` / `pip index`;
the research notes behind each row are kept with the initiative's report.

**Upstream maturity** (the standard): Stable · Extension · Draft · Incubating · Vendor-beta ·
Experimental.
**SDK maturity** (the official implementation, judged separately — a stable spec does not
make a mature SDK): GA · Stable-pre-1.0 · Beta · Community-only · None.
**v10r maturity** (this repository): Shipped · Built (branch) · Experiment (branch) · Planned ·
None. "Built" means code and tests on this branch; nothing here is `proven` until a live,
browser- or peer-verified run is recorded.
**Decision:** Adopt · Adapt · Experiment · Defer · Monitor · Reject.

## Summary

| Technology | Responsibility | Spec / version | Upstream | SDK | v10r | Decision | Reassess when |
|---|---|---|---|---|---|---|---|
| MCP server | Expose tools/knowledge | 2026-07-28 + 2025-11-25 | Stable | GA (`@modelcontextprotocol/server` 2.4.0) | Shipped | Adopt (keep) — see [mcp-evolution](../mcp-evolution/matrix.md) | Per MCP process |
| MCP client | Consume external tools | same | Stable | GA (`@modelcontextprotocol/client` 2.4.0) | Built (wired to the deskbot: peer directory, persistent claim, approval card) | **Adopt** | OAuth (CIMD) is wanted; AI SDK v7 lands |
| `@ai-sdk/mcp` | AI SDK's MCP client | — | — | Stable (own implementation; 1.0.105 on v6 line stops at 2025-11-25; 2.0.103 on v7 is still its own protocol code — no `@modelcontextprotocol/*` dependency — plus MCP Apps helpers) | None | Reject as the client (D10: official SDK); its MCP Apps visibility split is a pattern to copy, not a dependency | It builds on the official SDK, or v10r renders MCP Apps |
| MCP Tasks | Long-running tool calls | `io.modelcontextprotocol/tasks` (SEP-2663) | Extension | In SDK | None | Defer | A tool > 10 s, or durable execution adopted |
| MCP Skills ext. | Skills over MCP | `io.modelcontextprotocol/skills` (SEP-2640, Final, beta path) | Extension | "being implemented" | None | Defer (Agent Skills ship as files first) | SDK `skills/list` lands in `@modelcontextprotocol/server` |
| MCP Apps — provider | Ship an interactive view to AI hosts | SEP-1865, 2026-01-26, `text/html;profile=mcp-app` | Stable extension | GA-ish (`@modelcontextprotocol/ext-apps` 2.1.0) | Built (branch `claude/cloud/mcp-app-pattern-explorer`): `explore_patterns` + pattern explorer View, see [mcp-apps.md](../../ai/mcp-apps.md) | **Experiment** | A recorded run in Claude/ChatGPT/VS Code; the Claude Code compat kit run with a `_meta.ui` case |
| MCP Apps — host | Render third-party apps | same | Stable extension | `ext-apps/app-bridge` (framework-free) — "no supported host implementation" | None | **Defer** | A sandbox origin exists and a concrete third-party app is wanted |
| A2A — server | Serve a specialist agent | A2A 1.0.0 (Agentic AI Foundation) | Stable | GA (`@a2a-js/sdk` 1.3.0) | Built | **Adapt** | Durable tasks needed; auth needed |
| A2A — client | Delegate to independent agents | same | Stable | GA | Built (domain, pinned egress, approval-gated `delegate_architecture_review` on the deskbot through the persistent external-operations door; interop 24/24; PGlite race test against a loopback peer) | **Adapt** | A live provider turn delegates (local procedure) |
| AG-UI | Agent ↔ frontend events | `@ag-ui/core` 1.0.5 | Stable-pre-standard (CopilotKit-led, open) | Stable (core, `@ag-ui/client` 1.0.5); no Svelte, no AI SDK adapter | Built (branch `claude/cloud/ag-ui-endpoint`): `POST /api/ai/ag-ui/deskbot`, sequences verified by the official `HttpAgent` with a mock model | **Experiment** | A recorded run with a real provider and a third-party AG-UI frontend; an official AI SDK bridge ships |
| CopilotKit | AG-UI client framework | 1.90 | Vendor | React-only | None | Reject | Svelte support |
| A2UI | Generative UI protocol | v1.0 (2026-11-11) | Stable (fresh) | `@a2ui/web_core` 0.16.1 (lit-free root), `@a2ui/agent` 0.2.1; no Svelte renderer | Built (lazy renderer, catalog, validator, bench) | **Adapt** | 1.1; zod 4 in web_core; an official Svelte renderer |
| json-render | Generative UI (Vercel Labs) | 0.23.2 | Vendor-beta | Official Svelte 5 renderer | Measured only | Monitor (fallback renderer) | A2UI client weight becomes a problem |
| OpenUI Lang | Compact generative UI language | lang-core 1.1.1 | Vendor | Svelte binding lags (0.4); install telemetry | Measured only | Reject | Svelte binding current; telemetry removed |
| Code-generated UI | Sandboxed HTML/JS from a model | — | — | — | None | Reject (in-app) | A separately justified sandbox architecture |
| WebMCP | Browser-native page tools | W3C CG incubation; Chrome 146 dev trial, OT 149–156 | Incubating | Browser API; polyfill `@w3c/webmcp-polyfill` 0.2.0 | Experiment (adapter over client actions) | **Experiment** | Chrome 157 ships; TAG review; a second engine |
| Vercel UI SDK | Agent-aware headless components | 0.1.0-beta.16 | Vendor-beta | Beta, Svelte 5 adapter | None | Monitor | 1.0; documented AI SDK integration |
| Agent Skills | Portable instructions/methodology | agentskills.io (Agentic AI Foundation) | Stable (spec) | Validator demo-only | Built (generated from registry, gated) | **Adopt** | Spec revision; MCP skills extension in the SDK |
| ACP (Agent Client Protocol) | Editor ↔ coding agent | v1; v2 preview 2026-11-20 | Stable (v1) | GA (`@agentclientprotocol/sdk` 2.9.1) | None | **Defer (documented future pattern)** | Remote transport (HTTP/WS) leaves RFD; Studio hand-off is built |
| Agent Communication Protocol (IBM) | — | merged into A2A 2025-08 | Retired | — | — | Reject (superseded) | — |
| Workflow SDK | Durable functions/agents | `workflow` 5.8.0, `@workflow/sveltekit` | Vendor GA | GA (Vercel World); Postgres World not serverless | None | **Defer** | A run that must outlive a request |
| Temporal / Inngest / Trigger.dev | Durable execution | 1.26 / 4.8 / 4.27 | Vendor | GA | None | Reject for now | Same as above, if Vercel lock-in is unacceptable |
| OTel GenAI semconv | Standard agent telemetry | semantic-conventions-genai 0.1.0 | Development | `@ai-sdk/otel` (v7 only) | Built (pure projection) | **Adapt** | Conventions stabilise; an operator runs a backend |
| AI SDK v7 | Model/agent toolkit | 7.0.181 (GA 2026-06-25); branch pins 7.0.179 (24 h cooldown) | Vendor GA | GA; Svelte at chat parity, no MCP Apps renderer | Built (branch `claude/cloud/ai-sdk-v7`) | **Adopt — separate prerequisite branch**; `toolApproval`, MCP Apps helpers, `WorkflowAgent`, `@ai-sdk/otel` evaluated, none adopted ([../../ai/ai-sdk-v7.md](../../ai/ai-sdk-v7.md)) | Ship after one live chatbot turn + one approved deskbot write per provider |
| AGNTCY | Directory, identity, messaging | LF project | Incubating | Mixed | None | Monitor | A partner requires DID/VC or a directory |
| ANP | Decentralised agent network | W3C CG, spec 1.2 drafts | Draft | — | None | Monitor | Standards-track adoption |
| Agent registries | Discovery | A2A registry closed; MCP Registry v0.1 API freeze | Draft | — | None | Monitor (well-known card suffices) | A registry reaches GA |
| Agent frameworks (Mastra, LangGraph, ADK, OpenAI Agents, Claude Agent SDK, MS Agent Framework, Pydantic AI, CrewAI, Cloudflare Agents) | Alternative runtimes | various | — | — | Python a2a-sdk used as the independent peer | Reject as runtime; use as reference peers | A workload the AI SDK loop cannot serve |

## Detail

Columns the summary omits. *Overlap* names the existing v10r mechanism; *New* what the
standard adds that v10r lacked.

| Technology | Licence · governance | Framework fit | Overlap | New capability | Security implication | Performance / dependency | Complexity · maintenance | Educational · practical value | Pattern | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| MCP client | Apache-2.0 · AAIF / MCP steering | Framework-free, runs in Node/Edge over HTTP | `TOOL_MANIFEST` (no second registry: projected entries) | Third-party tools | Tool poisoning, annotation lies, SSRF, token passthrough → v10r-assigned risk, guard, no passthrough | Server-only; already a devDependency, now runtime; 0 client bytes | M · low (official SDK) | High · high | `ai-mcp-client` | [mcp-client.md](../../ai/mcp-client.md), unit + adversarial + Python FastMCP interop |
| A2A | Apache-2.0 · AAIF | `JsonRpcTransportHandler` behind `+server.ts`, no Express | Orchestrator, capabilities, external operations | Cross-framework, cross-language delegation; agent cards | Remote claims ≠ evidence; recursive delegation; SSRF; proxy bypass → operator allowlist, approval with disclosure and card digest, claim typing, budget, depth = 1, pinned egress shared with MCP | Server-only; `jose` only hard dep | M · medium (fast-moving ecosystem, 0.3 peers) | High · medium | `ai-agent-to-agent` | [agent-to-agent.md](../../ai/agent-to-agent.md), JS↔Python interop incl. delegation, timeout and cancel |
| AG-UI | MIT · CopilotKit-led | Core is framework-free; no Svelte client | AI SDK UI message stream, client actions | Standard event vocabulary other frontends speak | Frontend tools must not gain write power; a client must not fabricate server tool results or approval state → only declared client actions accepted, server results admitted only under a server-issued ticket, `state`/`resume` refused, decisions via the approve route | `@ag-ui/core` runtime (input schemas); `@ag-ui/client` devDependency (verification); SSE framed in-house (the encoder pulls protobuf) | M · low | Medium · low today | `ai-agent-user-interaction` | [agent-user-interaction.md](../../ai/agent-user-interaction.md), events validated by the official schemas; endpoint sequences verified through `HttpAgent` + `verifyEvents` |
| A2UI | Apache-2.0 · Google-led, open | Lit-free `web_core` root + own Svelte adapter | Tool-driven fixed cards | Model-composed native UI from a trusted catalog | Data not code; catalog allowlist; actions view-risk only | Lazy chunk (~70 KB gzip, plus a 13 KB zod 3 chunk shared with the chat), off every eager route | M · medium (fast-breaking 0.x core) | High · high | `ai-generative-ui` | [generative-ui.md](../../ai/generative-ui.md), bench report |
| WebMCP | W3C CG | Browser API | Client actions | External browser agents operate the page semantically | Only read/view actions publishable; budget; untrusted hint | ~0 (feature-detected, no polyfill shipped) | S · low | High · low today | `ai-webmcp` | [webmcp.md](../../ai/webmcp.md) |
| Agent Skills | Apache-2.0 spec · AAIF | Plain files | Generated docs pages, MCP pattern tools | Loaded natively by 70+ agent products | Skills are instructions → generated only from the reviewed registry | Repository files only | S · low (generated, gated) | High · high | `ai-agent-skills` | [agent-skills.md](../../ai/agent-skills.md), `skills:check` |
| OTel GenAI | Apache-2.0 · CNCF | Pure projection; exporter optional | Turn trace | Any OTel backend reads v10r turns | Content capture forbidden by construction | 0 dependencies | S · low (pinned revision) | Medium · medium | `ai-agent-observability` | [agent-observability.md](../../ai/agent-observability.md) |
| MCP Apps provider | Apache-2.0 · MCP | `ext-apps/server` on the existing server | Pattern tools (registry projection) | Interactive views inside MCP Apps hosts | Provider ships HTML that hosts sandbox; empty CSP domain lists, no permissions | Server helpers ~0.6 KB; View document 320 KB (86 KB gzip, served per render, outside the client bundle) | M | High · medium | (planned) `ai-mcp-app-provider` | [mcp-apps.md](../../ai/mcp-apps.md); MCP Inspector 2.16.0 web host rendered it (Playwright screenshots); Claude/ChatGPT untested |
| MCP Apps host | same | Needs a separate sandbox origin | — | Third-party apps in v10r | Sandbox escape, exfiltration, consent — a separate security programme | Sandbox proxy origin | L · high | Medium · low | none | research only |
| Durable execution | various | Workflow SDK first-party SvelteKit | Proposals already persist across requests | Runs that outlive a request | Replay/idempotency | Vercel lock-in (Vercel World) | L · medium | High · none today | (planned) `ai-durable-agent` | research only |
| ACP | Apache-2.0 · Zed-led | stdio only today | Pattern MCP for coding agents | Studio → coding-agent hand-off | Remote execution boundary undefined until remote transport | — | M | High · none today | (planned) `ai-agent-client-protocol` | research only |

## Reassessment log

| Date | Row | Change |
|---|---|---|
| 2026-11-24 | all | Initial assessment (this initiative) |
| 2026-11-24 | A2A — client | Pinned egress shared with MCP; assistant-driven delegation as an approval-gated external operation (wired to the deskbot through the external-operations door, `A2A_DELEGATION_PEERS`); streaming + `CancelTask`; interop 24/24 |
| 2026-11-24 | MCP client | Wired to the deskbot through the external-operations domain: `ai.mcp_peer` directory and `/admin/ai/peers`, persistent claim in `ai.agent_external_operation`, content screen, `ExternalOperationCard` ([external-operations.md](../../ai/external-operations.md)) |
