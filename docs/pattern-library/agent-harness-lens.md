---
title: "Agent-harness audit lens"
description: "A conceptual audit lens (not a module) names which slice — loop, context, policy, or tools — owns each agent-harness primitive such as compaction, step caps…"
category: "AI"
---

# Agent-harness audit lens

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** principle — apply it to the work; it builds nothing and is never a step to build first

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — governs the agent loop that drives external LLM providers

A conceptual audit lens (not a module) names which slice — loop, context, policy, or tools — owns each agent-harness primitive such as compaction, step caps, and approval gating.

**When to use:** Use when auditing whether an LLM-agent product has the harness primitives it needs and where each one is implemented.

## Docs

- [docs/blueprint/ai/harness-lens.md](/docs/blueprint/ai/harness-lens) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/harness-lens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/harness-lens.md))

## Code

- `src/lib/server/ai/loop/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/ai/loop) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/ai/loop))
- `src/lib/server/ai/policy/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/ai/policy) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/ai/policy))

## Tests

- `src/lib/server/ai/loop/compact.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/loop/compact.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/loop/compact.test.ts))
- `src/lib/server/ai/policy/governor.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/policy/governor.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/policy/governor.test.ts))

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `agent-harness-lens` in `pattern-library/registry.json`._
