---
title: "Turn trace as OpenTelemetry GenAI spans"
description: "Projects a recorded turn trace onto invoke_agent, chat and execute_tool spans with GenAI semantic-convention names, v10r facts under v10r.*, and no content by…"
category: "AI"
---

# Turn trace as OpenTelemetry GenAI spans

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** light · **Maturity:** implemented · **Risk:** low — pure projection

Projects a recorded turn trace onto invoke_agent, chat and execute_tool spans with GenAI semantic-convention names, v10r facts under v10r.*, and no content by construction — a lossy, exporter-neutral export beside the audit-grade trace.

**When to use:** Use when an OpenTelemetry backend should read agent turns without a second tracer.

**Needs:** required llm-provider (via ai-surfaces, ai-tool-harness), relational-db (via turn-trace)

## Avoid when

- No telemetry backend exists — the trace and admin pages already answer the questions

## Docs

- [docs/blueprint/ai/agent-observability.md](/docs/blueprint/ai/agent-observability) — Span mapping and the three records ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/agent-observability.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/agent-observability.md))

## Code

- `src/lib/server/ai/trace/gen-ai-spans.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/trace/gen-ai-spans.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/trace/gen-ai-spans.ts))

## Tests

- `src/lib/server/ai/trace/gen-ai-spans.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/trace/gen-ai-spans.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/trace/gen-ai-spans.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Turn trace and turn graph](/docs/pattern-library/turn-trace) — It projects a recorded turn trace onto spans; without the trace there is nothing to export.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Agentic architecture](/docs/pattern-library/agentic-architecture) (optional)


---

_Machine-readable record: `agent-observability` in `pattern-library/registry.json`._
