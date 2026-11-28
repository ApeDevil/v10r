---
title: "Agentic architecture"
description: "How an application becomes AI-accessible, AI-interactive and AI-adaptive without a second architecture per standard: the tool catalogue, orchestrator…"
category: "Architecture & Request Pipeline"
---

# Agentic architecture

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** implemented · **Risk:** medium — many young standards; contained because each is an optional adapter with its own gate

How an application becomes AI-accessible, AI-interactive and AI-adaptive without a second architecture per standard: the tool catalogue, orchestrator, approval gate, untrusted-content boundary and turn trace stay authoritative, and MCP, A2A, AG-UI, A2UI, WebMCP, Agent Skills and OpenTelemetry are adapters that translate into them and never decide. A living matrix grades every technology (upstream, SDK and implementation maturity kept apart) with an adoption decision and a reassessment trigger.

**When to use:** Use when deciding which agentic standards an application should speak, and how, without accumulating runtimes: before adopting a protocol, framework or generative-UI format.

**Needs:** required llm-provider (via ai-agent-actions), relational-db (via deskbot-approval-gate)

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

## Depends on

- [Agent actions](/docs/pattern-library/ai-agent-actions)
- [Untrusted-content boundary](/docs/pattern-library/ai-untrusted-content-boundary)
- [MCP protocol evolution](/docs/pattern-library/architecture-mcp-evolution)

---

_Machine-readable record: `architecture-agentic-architecture` in `pattern-library/registry.json`._
