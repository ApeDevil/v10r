---
title: "Agent-harness audit lens (loop/context/policy/tools)"
description: "A conceptual audit lens (not a module) names which slice — loop, context, policy, or tools — owns each agent-harness primitive such as compaction, step caps…"
category: "AI"
---

# Agent-harness audit lens (loop/context/policy/tools)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Risk:** medium — governs the agent loop that drives external LLM providers

A conceptual audit lens (not a module) names which slice — loop, context, policy, or tools — owns each agent-harness primitive such as compaction, step caps, and approval gating.

**When to use:** Use when auditing whether an LLM-agent product has the harness primitives it needs and where each one is implemented.

## Docs

- [docs/blueprint/ai/harness-lens.md](/docs/blueprint/ai/harness-lens) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/harness-lens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/harness-lens.md))

## Code

- `src/lib/server/ai/loop/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/ai/loop) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/ai/loop))
- `src/lib/server/ai/policy/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/ai/policy) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/ai/policy))

---

_Machine-readable record: `ai-harness-lens` in `mcp/patterns.registry.json`._
