---
title: "Heavy dependency quarantine (the baseline is the metric)"
description: "Optional heavyweight capabilities load behind dynamic-import boundaries, and the gated metric is not the route's own size but the shared baseline every other…"
category: "Runtime Velocity"
---

# Heavy dependency quarantine (the baseline is the metric)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 149f43a7-dirty) · **Risk:** medium — the gate fails a build, which is the point

Optional heavyweight capabilities load behind dynamic-import boundaries, and the gated metric is not the route's own size but the shared baseline every other route pays — `baseline_js_kb`, ratcheted with ~3% headroom.

**When to use:** Use when a dependency is large, feature-specific, rarely used, browser-only or expensive to initialize — 3D, maps, charts, editors, graph visualization.

## Avoid when

- The dependency is small or needed by most routes, so splitting it out moves no weight off the shared baseline
- The page weight is images or fonts rather than client JavaScript — that is asset delivery's problem

## Alternatives

- **import the module directly instead of through a barrel** — prefer when the weight comes from an unrelated sibling the barrel drags in, not from the capability itself
- **asset delivery work (responsive images, AVIF/WebP, font subsetting)** — prefer when images or fonts, not client JavaScript, dominate page load

## Docs

- [docs/blueprint/velocity/runtime.md#heavy-dependency-quarantine](/docs/blueprint/velocity/runtime) — Why the baseline is the number that matters ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `scripts/perf/snapshot.ts` — Walks the Vite manifest import graph and gzips each chunk ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/perf/snapshot.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/perf/snapshot.ts))
- `src/lib/server/perf/budgets.json` — baseline_js_kb ceiling — the shared cost of every route ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/budgets.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/budgets.json))
- `src/lib/components/shell/AppShell.svelte` — Command palette imported on first open, warmed at idle ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/AppShell.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/AppShell.svelte))

## Tests

- `src/lib/server/perf/snapshot.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/snapshot.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/snapshot.gate.test.ts))

## Proof

- [`/showcases/observability/budgets`](/showcases/observability/budgets)

## Invariants

- An optional heavy capability does not enter the shared baseline without explicit justification.
- Browser-only capabilities stay off SSR paths unless needed.
- The question a bundle review answers is 'did this capability make every OTHER route heavier', not 'is this route big'.

## Emulation notes

- A barrel of Svelte components keeps every component it re-exports unless the component tree is declared side-effect free — see side-effect-free-components. Barrels of plain modules still need care: v10r imports `CodeBlock` directly because the composites barrel would pull the markdown sanitizer along.
- The bundle gate must run a PRODUCTION build; a dev-mode build compiles both halves differently and inflates client JS ~9%. Note that v10r's `validate` has no build step — bundle regressions are only caught by `validate:build`.
- A closed-by-default surface in a layout every route shares (a command palette, a dialog, an auth client used by one button) is a heavy capability too. Import it on first intent and warm it at idle; the cost is a network wait on first open if idle never came. v10r's palette and better-auth client moved the median route 241.9 -> 231.1 KB gz.

## Depends on

- [Performance budget and ratchet (targets aspire, ceilings hold)](/docs/pattern-library/performance-budget-ratchet)

---

_Machine-readable record: `heavy-dependency-quarantine` in `pattern-library/registry.json`._
