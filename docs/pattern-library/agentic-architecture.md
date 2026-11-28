---
title: "Agentic architecture"
description: "How an application becomes AI-accessible, AI-interactive and AI-adaptive without a second architecture per standard: the tool catalogue, orchestrator…"
category: "Architecture & Request Pipeline"
---

# Agentic architecture

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Kind:** pattern — build it in the target project

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** implemented · **Risk:** medium — many young standards; contained because each is an optional adapter with its own gate

How an application becomes AI-accessible, AI-interactive and AI-adaptive without a second architecture per standard: the tool catalogue, orchestrator, approval gate, untrusted-content boundary and turn trace stay authoritative, and MCP, A2A, AG-UI, A2UI, WebMCP, Agent Skills and OpenTelemetry are adapters that translate into them and never decide. A living matrix grades every technology (upstream, SDK and implementation maturity kept apart) with an adoption decision and a reassessment trigger.

**When to use:** Use when deciding which agentic standards an application should speak, and how, without accumulating runtimes: before adopting a protocol, framework or generative-UI format.

**Needs:** required llm-provider (via agent-actions, ai-surfaces, ai-tool-harness, deskbot-approval-gate, untrusted-content-boundary), relational-db (via deskbot-approval-gate, durable-step-execution, turn-trace) · conditional external-api (when the application serves a specialist agent or delegates to other agents over A2A; or when the assistant consumes tools from external MCP servers; via agent-to-agent, mcp-client), key-value-store (when the application serves its tools to MCP clients; via rate-limiting)

## Avoid when

- The application has no agent and no external agent callers — none of the doors buys anything
- You want one framework to own the agent loop end to end — adopt that framework instead of adapting to it

## Alternatives

- **Adopt an agent framework (Mastra, LangGraph, Google ADK) as the runtime because it already speaks the protocols** — prefer when you have no existing tool catalogue, approval model or trace, and accept the framework's
- **Integrate each standard on its own terms** — prefer when a one-off prototype that will not grow a second standard

## Docs

- `docs/blueprint/architecture/agentic-architecture/README.md` — Conceptual model, domains, topology ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/agentic-architecture/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/agentic-architecture/README.md))
- [docs/blueprint/architecture/agentic-architecture/matrix.md](/docs/blueprint/architecture/agentic-architecture/matrix) — The technology matrix ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/agentic-architecture/matrix.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/agentic-architecture/matrix.md))
- [docs/blueprint/architecture/agentic-architecture/decision-record.md](/docs/blueprint/architecture/agentic-architecture/decision-record) — Decisions AA1–AA14 ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/agentic-architecture/decision-record.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/agentic-architecture/decision-record.md))
- [docs/blueprint/architecture/agentic-architecture/security.md](/docs/blueprint/architecture/agentic-architecture/security) — One trust model across every door ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/agentic-architecture/security.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/agentic-architecture/security.md))

## Code

- `src/lib/server/http/egress-address.ts` — The one SSRF address policy every outbound peer client shares ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/egress-address.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/egress-address.ts))

## Tests

- `src/lib/server/ai/mcp-client/mcp-client.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/mcp-client/mcp-client.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/mcp-client/mcp-client.gate.test.ts))
- `src/lib/generative-ui/generative-ui.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/generative-ui/generative-ui.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/generative-ui/generative-ui.gate.test.ts))
- `src/lib/client-actions/webmcp.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/client-actions/webmcp.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/client-actions/webmcp.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Invariants

- No standard gets its own tool registry, orchestrator, permission system or trace; every door ends in an existing mechanism.
- Risk is assigned by the application from what an operation does; a protocol hint (annotation, skill tag, button, frontend-tool declaration) may raise a risk, never lower it.
- A remote agent's or external tool's answer is a claim: validated, bounded, wrapped as untrusted content, never an authorization input and never shown as verified.
- Upstream maturity, SDK maturity and implementation maturity are recorded separately; an experiment is never graded proven.

## Emulation notes

- Start from your catalogue and approval model, not from the protocols: list which existing mechanism each door would end in before installing anything.
- Keep one living matrix with a reassessment trigger per row; review it on a schedule, not by automation.
- Extract a shared module only when two doors have actually implemented the same responsibility (here: the egress address policy).

## Relationships

**Composes (constituents of its solution)**

- [Agent actions](/docs/pattern-library/agent-actions) — required: The tool catalogue with risk and executor is the authoritative door every standard ends in.
- [Untrusted-content boundary](/docs/pattern-library/untrusted-content-boundary) — required: A remote agent's or external tool's answer is a claim: it reaches the model only as untrusted content.
- [Turn trace and turn graph](/docs/pattern-library/turn-trace) — required: The turn trace is the one authoritative record of what a turn did; telemetry exports are projections of it.
- [MCP protocol evolution](/docs/pattern-library/mcp-protocol-evolution) — conditional when the application serves its tools to MCP clients: MCP is one adapter onto the tool catalogue; when the application speaks it, it must serve both protocol eras from one registry.
- [MCP client](/docs/pattern-library/mcp-client) — conditional when the assistant consumes tools from external MCP servers: External MCP tools are projected into the existing catalogue with deployment-assigned risk, never a second registry.
- [Agent to agent](/docs/pattern-library/agent-to-agent) — conditional when the application serves a specialist agent or delegates to other agents over A2A: A2A is an adapter: delegation is an approval-gated external operation and every answer is a claim.
- [AG-UI endpoint over the turn stream](/docs/pattern-library/ag-ui-endpoint) — conditional when AG-UI clients must drive the agent: AG-UI is served by the same orchestrator turn under a deny-by-default export policy, not a second runtime.
- [Generative UI](/docs/pattern-library/generative-ui) — conditional when the model composes interface as data: Generated interface is data from a closed catalogue rendered by the app’s own components; a press is never an approval.
- [Agent Skills generated from the pattern registry](/docs/pattern-library/agent-skills) — conditional when the application's knowledge must reach agent products that load Agent Skills: Agent Skills are a generated projection of the canonical registry, never a hand-maintained copy.
- [WebMCP publication of client actions](/docs/pattern-library/webmcp) — optional when the visitor's browser offers its own agent: Progressive enhancement: existing client-action contracts are published to the browser agent; nothing depends on it.
- [Turn trace as OpenTelemetry GenAI spans](/docs/pattern-library/agent-observability) — optional when turns should also appear in an OpenTelemetry backend: A lossy, exporter-neutral projection of the turn trace; the trace stays the audit record.
- [MCP App provider](/docs/pattern-library/mcp-app-provider) — optional when an MCP host should render an interactive View beside a tool answer: The text answer is complete on its own; the View only adds interaction.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `agentic-architecture` in `pattern-library/registry.json`._
