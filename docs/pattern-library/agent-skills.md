---
title: "Agent Skills generated from the pattern registry"
description: "The canonical pattern registry is projected into spec-valid Agent Skills (one per registry group plus an architecture-selection skill, per-pattern references…"
category: "Docs & Agent Experience"
---

# Agent Skills generated from the pattern registry

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Kind:** pattern — build it in the target project

**Category:** Docs & Agent Experience · **Tier:** deep · **Maturity:** implemented · **Risk:** low — generated files, gated

The canonical pattern registry is projected into spec-valid Agent Skills (one per registry group plus an architecture-selection skill, per-pattern references disclosed on demand), generated deterministically and checked in the gate — so any skills-compatible agent loads the same knowledge the docs, MCP tools and RAG corpus serve, with no hand-maintained copy.

**When to use:** Use when knowledge with a canonical machine-readable source should reach the agent products (editors, CLIs, assistants) that load Agent Skills.

## Avoid when

- The knowledge has no canonical source yet — write that first
- Every consumer already reaches you over MCP — the pattern tools may be enough

## Alternatives

- **MCP skills extension (skills/list, skill:// resources)** — prefer when the official SDK serves it and your consumers prefer protocol over files

## Docs

- [docs/blueprint/ai/agent-skills.md](/docs/blueprint/ai/agent-skills) — Granularity, generator, validator, sizes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/agent-skills.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/agent-skills.md))

## Code

- `src/lib/server/patterns/agent-skills.ts` — The renderer ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/patterns/agent-skills.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/patterns/agent-skills.ts))
- `src/lib/server/patterns/agent-skill-spec.ts` — The spec validator ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/patterns/agent-skill-spec.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/patterns/agent-skill-spec.ts))
- `skills//` — Generated agent skills ([GitHub](https://github.com/ApeDevil/v10r/tree/main/skills/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/skills/))

## Tests

- `src/lib/server/patterns/agent-skills.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/patterns/agent-skills.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/patterns/agent-skills.test.ts))
- `src/lib/server/patterns/agent-skill-spec.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/patterns/agent-skill-spec.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/patterns/agent-skill-spec.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Invariants

- skills/ is generated from the registry and fails the gate when stale or invalid; it is never edited by hand.
- Every SKILL.md stays within the spec's progressive-disclosure limits (body under 500 lines and 5,000 tokens); detail lives in references/.
- Maturity is stated honestly: implemented is never presented as proven.

## Emulation notes

- Choose granularity by what sits in the agent's context permanently: every installed skill's description does.
- Reuse the renderer that builds your docs pages so the two projections cannot disagree.

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Reproducible artifact build](/docs/pattern-library/reproducible-artifact-build) — skills/ is a committed generated artifact that fails the gate when stale; any regenerate-and-check gate satisfies it.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Agentic architecture](/docs/pattern-library/agentic-architecture) (conditional)

**Referenced by**

- [Pattern Index](/docs/pattern-library/pattern-index)


---

_Machine-readable record: `agent-skills` in `pattern-library/registry.json`._
