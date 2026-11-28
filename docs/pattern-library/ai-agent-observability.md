---
title: "Turn trace as OpenTelemetry GenAI spans"
description: "Projects a recorded turn trace onto invoke_agent, chat and execute_tool spans with GenAI semantic-convention names, v10r facts under v10r.*, and no content by…"
category: "AI"
---

# Turn trace as OpenTelemetry GenAI spans

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** implemented · **Risk:** low — pure projection

Projects a recorded turn trace onto invoke_agent, chat and execute_tool spans with GenAI semantic-convention names, v10r facts under v10r.*, and no content by construction — a lossy, exporter-neutral export beside the audit-grade trace.

**When to use:** Use when an OpenTelemetry backend should read agent turns without a second tracer.

**Needs:** required relational-db (via ai-turn-trace), llm-provider (via ai-surfaces)

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

## Depends on

- [Turn trace and turn graph](/docs/pattern-library/ai-turn-trace)

---

_Machine-readable record: `ai-agent-observability` in `pattern-library/registry.json`._
