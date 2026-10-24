---
title: "Side-effect-free component tree (barrels that tree-shake)"
description: "Compiled Svelte components run code at module scope, so the bundler keeps every component a barrel re-exports. Declaring the component directory side-effect…"
category: "Runtime Velocity"
---

# Side-effect-free component tree (barrels that tree-shake)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 149f43a7-dirty) · **Risk:** medium — a module that relied on a side-effect import breaks silently; the gate test is the guard

Compiled Svelte components run code at module scope, so the bundler keeps every component a barrel re-exports. Declaring the component directory side-effect free in the bundler makes an unused export droppable — and an import made for side effects alone silently vanishes, which a gate forbids.

**When to use:** Use when a Svelte component library is consumed through barrel files and the shared or per-route bundle carries components the page never renders.

## Avoid when

- A module in the tree registers something at module scope (a custom element, a global listener, a plugin) — that import would be dropped without an error
- Components are always imported from their own files, so no barrel can drag siblings along

## Alternatives

- **leaf imports instead of barrel imports** — prefer when the barrel has few consumers and a lint rule can keep it that way — in v10r, rewriting the shell's imports alone changed nothing because pages import the barrel too
- **package.json "sideEffects" for a published component package** — prefer when the components ship as a separate npm package rather than an in-repo directory

## Docs

- [docs/blueprint/velocity/runtime.md#side-effect-free-component-tree](/docs/blueprint/velocity/runtime) — Why Svelte barrels keep everything, the measurement, and the price ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `vite.config.ts` — build.rolldownOptions.treeshake.moduleSideEffects rules for src/lib/components/ and Paraglide's compiled messages ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vite.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vite.config.ts))

## Tests

- `src/lib/server/perf/snapshot.gate.test.ts` — losing the declaration pushes the median route past its ceiling ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/snapshot.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/snapshot.gate.test.ts))

## Invariants

- Nothing imports a component module for its side effects alone — under the declaration such an import is dropped silently. `architecture.gate.test.ts` enforces it.
- The declaration covers exactly the directory whose modules are pure; anything that registers at module scope lives outside it.
- The effect is held by a bundle ratchet, so removing the declaration fails a build rather than going unnoticed.

## Emulation notes

- The cause is the compiler output, not the authoring: $.delegate(...) and template factories at module scope make every compiled .svelte file side-effecting in the bundler's eyes. One `import { Button } from '#lib/components/index.ts'` shipped v10r's whole primitives layer — culori and bits-ui's select and menu included — to 197 of 199 routes.
- Under Vite 8 (Rolldown) declare it as a rule list, `[{ test: COMPONENT_MODULE, external: false, sideEffects: false }]`. A function that returns `true` for everything else pins those modules as side-effectful, overriding their package.json `sideEffects` and Rolldown's own analysis; a module no rule matches stays unclassified and keeps both.
- Rolldown assigns a module to a chunk by who imports it, not by which exports survive. Generated code reached through one barrel needs the same declaration: Paraglide's ~3,260 compiled message modules, re-exported by `messages.js`, all landed in one 215 KB (gz) chunk every route loaded until they were declared side-effect free (median route 420 -> 226 KB).
- Measured (production build, gzip, full route chain): median route 296.7 -> 241.9 KB, heaviest 562.8 -> 521.5 KB. The shared baseline grew 3 KB because finer chunks lengthen the per-node preload lists in the generated app.js; that raise was reviewed and recorded, not absorbed.

## Depends on

- [Performance budget and ratchet (targets aspire, ceilings hold)](/docs/pattern-library/performance-budget-ratchet)

---

_Machine-readable record: `side-effect-free-components` in `pattern-library/registry.json`._
