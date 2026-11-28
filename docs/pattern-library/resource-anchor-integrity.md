---
title: "Resource anchor integrity"
description: "Every #fragment a registry doc ref names must be a heading the page renders, checked through the renderer's own slugger, and every path an agent instruction…"
category: "Truth & Evidence"
---

# Resource anchor integrity

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Truth & Evidence · **Tier:** light · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — build-time only

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

## Invariants


Inherited from [Source-of-truth gate](/docs/pattern-library/source-of-truth-gate) (specializes):

- One fact, one owner. A second writable copy is a defect, not a configuration option.
- Every non-owner copy is typed, imported, generated with a check, or drift-tested — there is no fifth kind.
- A drift test asserts its own scan was non-empty; an empty list must not pass vacuously.
- Exemption lists fail when an entry no longer applies, so allowances only shrink.
- Reading the owner succeeds or fails loudly; it never silently substitutes another source.

## Relationships

**Specializes (its invariants hold here; it is never built twice)**

- [Source-of-truth gate](/docs/pattern-library/source-of-truth-gate) — Each fragment and routed path has one owner (the rendered heading, the file) and a gate checks every copy against it.


---

_Machine-readable record: `resource-anchor-integrity` in `pattern-library/registry.json`._
