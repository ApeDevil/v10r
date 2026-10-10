---
title: "Resource anchor integrity (fragments and routing paths resolve)"
description: "Every #fragment a registry doc ref names must be a heading the page renders, checked through the renderer's own slugger, and every path an agent instruction…"
category: "Docs & Agent Experience"
---

# Resource anchor integrity (fragments and routing paths resolve)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Docs & Agent Experience · **Tier:** light · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — build-time only

Every #fragment a registry doc ref names must be a heading the page renders, checked through the renderer's own slugger, and every path an agent instruction file routes to must exist — a narrow, build-time slice of W3C-style resource anchoring.

**When to use:** Use when docs, registries or agent context files deep-link into headings or route agents to repo paths that refactors can move.

## Avoid when

- Links are generated from the same source as their targets — they cannot drift

## Docs

- [docs/blueprint/architecture/agent-experience.md#links-and-routing-stay-resolvable](/docs/blueprint/architecture/agent-experience) — What is gated, and what (chat citation anchors) is not ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/agent-experience.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/agent-experience.md))

## Code

- `src/lib/docs/heading-anchors.server.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/docs/heading-anchors.server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/docs/heading-anchors.server.ts))
- `pattern-library/validate.ts` — Fragment check in checkRef ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/validate.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/validate.ts))

## Tests

- `src/lib/docs/heading-anchors.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/docs/heading-anchors.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/docs/heading-anchors.test.ts))
- `src/lib/agent-instructions.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/agent-instructions.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/agent-instructions.gate.test.ts))

---

_Machine-readable record: `resource-anchor-integrity` in `pattern-library/registry.json`._
