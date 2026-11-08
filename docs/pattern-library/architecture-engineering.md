---
title: "Architecture Engineering (explained decision records, a typed architecture model and static checks)"
description: "A deterministic decision discipline for where code runs, how parts talk, where data lives and how it ships. Versioned decision records (problem, alternatives…"
category: "Architecture & Request Pipeline"
---

# Architecture Engineering (explained decision records, a typed architecture model and static checks)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** implemented · **Risk:** low — read-only reasoning over a reviewed rule table; the main risk is a recommendation read as authoritative, mitigated by showing the rule, the alternatives, the unknowns and the evidence kind on every outcome

A deterministic decision discipline for where code runs, how parts talk, where data lives and how it ships. Versioned decision records (problem, alternatives, ordered rules, evidence with its kind, migrations) drive an engine that answers a workload profile with the chosen approach, the rule that chose it, why each alternative lost and which unknown factor could change it; no scoring formula and no LLM. A separate architecture model (components, zones, connections; layout stored apart) is parsed fail-closed, edited through pure operations, statically checked (security findings kept apart, fixed severity per code) and compared qualitatively. The Studio at /studio/architecture and the explore_architecture/check_architecture MCP tools run the same engine.

**When to use:** Use when architecture choices (browser vs server compute, JS vs Rust/Wasm, monolith vs service, SQL vs application processing) need to be explained, reviewable and reproducible rather than asserted, and when a team or an agent should get the same answer from the same inputs.

## Avoid when

- The decision has one obvious answer in this codebase — a record and a rule add ceremony without information
- You need performance numbers — the engine and the comparison are qualitative; measure in a lab and cite it as evidence instead
- Decisions must be learned from data or tuned per tenant — this pattern is a fixed, reviewed rule table by design

## Alternatives

- **Plain Markdown ADRs (MADR / Nygard) without an engine** — prefer when decisions are few, made once, and nobody needs to re-evaluate them against changing inputs
- **A weighted scoring matrix** — prefer when stakeholders explicitly want a ranked trade-off and accept that the weights are opinion, stated as such
- **Diagram-only tools (C4 / Structurizr DSL)** — prefer when the need is communicating an architecture, not checking it or deriving it from a workload

## Docs

- [docs/blueprint/architecture-engineering/how-it-works.md](/docs/blueprint/architecture-engineering/how-it-works) — The discipline: domains, decision records and rule evaluation, the architecture model, checks, comparison, evidence ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture-engineering/how-it-works.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture-engineering/how-it-works.md))
- [docs/blueprint/architecture-engineering/plan.md](/docs/blueprint/architecture-engineering/plan) — Contracts, invariants, phases and progress record ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture-engineering/plan.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture-engineering/plan.md))
- [docs/blueprint/architecture-engineering/research.md](/docs/blueprint/architecture-engineering/research) — Internal inventory, names already spoken for, external research with sources ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture-engineering/research.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture-engineering/research.md))

## Code

- `pattern-library/architecture-engineering/decisions.json` — The decision catalogue: seven records across five domains ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/decisions.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/decisions.json))
- `pattern-library/architecture-engineering/decision-record.ts` — Decision record contract and its fail-closed parser; reference checks against the registry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/decision-record.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/decision-record.ts))
- `pattern-library/architecture-engineering/explore.ts` — The engine: ordered rules, unknown-aware matching, contradictions, fallback to the simplest alternative ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/explore.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/explore.ts))
- `pattern-library/architecture-engineering/architecture-model.ts` — Architecture model and layout, strict bounded parser, canonical stringify ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/architecture-model.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/architecture-model.ts))
- `pattern-library/architecture-engineering/model-operations.ts` — Pure model operations returning a new model or a named refusal ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/model-operations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/model-operations.ts))
- `pattern-library/architecture-engineering/checks.ts` — Static checks: security apart from runtime, communication, data and structure ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/checks.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/checks.ts))
- `pattern-library/architecture-engineering/compare.ts` — Baseline vs variant: structural diffs and qualitative assessment ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/compare.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/compare.ts))
- `pattern-library/architecture-queries.ts` — explore_architecture and check_architecture for both MCP transports ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-queries.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-queries.ts))
- `src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-studio.svelte.ts` — Studio state: undo/redo with coalescing, working copy, drafts, variants ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-studio.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-studio.svelte.ts))
- `src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-drafts.ts` — Local-first drafts; every read goes through the parser ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-drafts.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-drafts.ts))

## Tests

- `pattern-library/architecture-engineering/explore.test.ts` — Determinism, unknown handling, every decision reachable, catalogue integrity ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/explore.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/explore.test.ts))
- `pattern-library/architecture-engineering/architecture-model.test.ts` — Parser bounds and integrity, operations, refusals, canonical round trip ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/architecture-model.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/architecture-model.test.ts))
- `pattern-library/architecture-engineering/checks.test.ts` — Every finding code reached; comparison and evolution; no measured claims ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-engineering/checks.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-engineering/checks.test.ts))
- `pattern-library/architecture-queries.test.ts` — MCP tools: deterministic output, bounded refusals, no caller-text echo ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/architecture-queries.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/architecture-queries.test.ts))
- `src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-studio.svelte.test.ts` — Explore→Design transfer, undo/redo, layout apart from model, variants, import refusal ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-studio.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/(public)/studio/architecture/_state/architecture-studio.svelte.test.ts))

## Proof

- [`/studio/architecture`](/studio/architecture) (app route, no showcase)
- [`/studio/architecture/explore`](/studio/architecture/explore) (app route, no showcase)
- [`/studio/architecture/design`](/studio/architecture/design) (app route, no showcase)
- [`/studio/architecture/engineer`](/studio/architecture/engineer) (app route, no showcase)

## Invariants

- Every recommendation names the rule that chose it and the inputs it used; with no matching rule the simplest alternative is chosen and labelled a default
- An unknown factor is never guessed: a rule blocked only by unknowns is reported as missing information, a rule contradicted by a known value names the contradiction
- Rules are ordered and deterministic — no weights, no scores, no LLM; the same profile and engine revision always give the same result
- Evidence carries its kind (measured, live measurement, reference implementation, documented reasoning, external study, estimate); a measured claim states its conditions, and no comparison reports a number it did not measure
- Every pattern id and evidence reference in a decision resolves — patterns:validate fails otherwise
- The model is independent of its presentation: positions live in a separate layout, and a move never changes the model
- Imported and stored models are untrusted: strict keys, bounded sizes, integrity checks, fail-closed; nothing in a model is executed or rendered as HTML
- Security findings are a separate category with fixed severities, never merged into cosmetic diagram checks

## Emulation notes

- Keep the engine and the catalogue framework-free and dependency-free so a CLI, an MCP server and the UI share one implementation
- Start with a handful of decisions that your team actually revisits; add a rule only with the reason it encodes
- Label evidence honestly: link to the lab that measured it, and mark a gap as an estimate until someone measures it
- Persist drafts locally first; the file format is the contract, so a server store can be added later without changing the model

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)
- [Rust→wasm compute kernel (vendored, plugin-free)](/docs/pattern-library/architecture-wasm-kernel)
- [External service runtime (a separately deployed backend behind a typed client)](/docs/pattern-library/architecture-external-service)
- [Pattern MCP (agent-queryable pattern registry, local stdio)](/docs/pattern-library/architecture-pattern-mcp)

---

_Machine-readable record: `architecture-engineering` in `pattern-library/registry.json`._
