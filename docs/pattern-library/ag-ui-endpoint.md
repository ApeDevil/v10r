---
title: "AG-UI endpoint over the turn stream"
description: "Serves an existing AI SDK agent to AG-UI clients without a second runtime: RunAgentInput is validated by the official schemas and mapped onto the surface's…"
category: "AI"
---

# AG-UI endpoint over the turn stream

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** light · **Maturity:** implemented · **Risk:** medium — an authenticated, mutating surface behind the AI guard; deny-by-default export

Serves an existing AI SDK agent to AG-UI clients without a second runtime: RunAgentInput is validated by the official schemas and mapped onto the surface's own request, the same orchestrator turn runs, and its stream is projected to AG-UI events under a deny-by-default export policy. Client actions are AG-UI frontend tools; server tool results replay only under a server-issued ticket; state and resume are refused, approvals stay on the approve route.

**When to use:** Use when an AG-UI frontend must talk to an existing AI SDK agent.

**Needs:** required llm-provider, relational-db (via deskbot-approval-gate, durable-step-execution)

## Avoid when

- Your only client is your own — keep the AI SDK stream

## Docs

- [docs/blueprint/ai/agent-user-interaction.md](/docs/blueprint/ai/agent-user-interaction) — Endpoint contract, run-input refusals, semantics table, export policy, verification ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/agent-user-interaction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/agent-user-interaction.md))

## Code

- `src/lib/server/ai/ag-ui/ui-stream-to-ag-ui.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/ag-ui/ui-stream-to-ag-ui.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/ag-ui/ui-stream-to-ag-ui.ts))
- `src/lib/server/ai/ag-ui/run-input.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/ag-ui/run-input.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/ag-ui/run-input.ts))
- `src/lib/server/ai/ag-ui/serve-run.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/ag-ui/serve-run.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/ag-ui/serve-run.ts))
- `src/lib/server/ai/ag-ui/tool-result-ticket.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/ag-ui/tool-result-ticket.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/ag-ui/tool-result-ticket.ts))
- `src/routes/api/ai/ag-ui/deskbot/+server.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/ai/ag-ui/deskbot/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/ai/ag-ui/deskbot/+server.ts))

## Tests

- `src/lib/server/ai/ag-ui/ui-stream-to-ag-ui.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/ag-ui/ui-stream-to-ag-ui.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/ag-ui/ui-stream-to-ag-ui.test.ts))
- `src/lib/server/ai/ag-ui/serve-run.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/ag-ui/serve-run.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/ag-ui/serve-run.test.ts))
- `src/routes/api/ai/ag-ui/deskbot/server.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/ai/ag-ui/deskbot/server.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/ai/ag-ui/deskbot/server.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Agent actions](/docs/pattern-library/agent-actions) — AG-UI frontend tools are the existing client actions.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Agentic architecture](/docs/pattern-library/agentic-architecture) (conditional)


---

_Machine-readable record: `ag-ui-endpoint` in `pattern-library/registry.json`._
