---
title: "Virtualized rendering (windowing maths split from the component)"
description: "A long list costs the size of the viewport instead of the size of the data; the windowing arithmetic lives in a pure module so its edge cases are testable…"
category: "Interaction Velocity"
---

# Virtualized rendering (windowing maths split from the component)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Interaction Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — presentational; the data contract is unchanged

A long list costs the size of the viewport instead of the size of the data; the windowing arithmetic lives in a pure module so its edge cases are testable without a browser, while the component owns only the effects.

**When to use:** Use above roughly 200 rows for tables, trees, explorer lists, timelines, feeds and logs. Below that, windowing adds more complexity than it removes.

## Docs

- [docs/blueprint/velocity/interaction.md#virtualized-rendering](/docs/blueprint/velocity/interaction) — Why uniform row height only ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/interaction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/interaction.md))

## Code

- `src/lib/components/primitives/virtual-list/` — Pure `virtual-list.ts` plus the component over it ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives/virtual-list) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives/virtual-list))

## Tests

- `src/lib/components/primitives/virtual-list/virtual-list.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/primitives/virtual-list/virtual-list.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/primitives/virtual-list/virtual-list.test.ts))

## Proof

- [`/showcases/velocity/interaction`](/showcases/velocity/interaction)

## Invariants

- Hidden items create no DOM or layout cost — the saving is layout and hit-testing, not only node count, which is why a long list gets slower to SCROLL and not merely slower to appear.
- Keyboard navigation and accessibility stay correct: the list owns focus and moves a roving `aria-activedescendant`, because the rows a user would Tab through mostly do not exist.
- Scroll position stays stable — a `scrollTop` past the end clamps instead of stranding the user on a blank screen they cannot scroll out of.
- A spacer carries the full data height so the scrollbar describes the list rather than the rendered window.

## Emulation notes

- Uniform row height only, on purpose. Variable heights need measurement, a resize observer and a running offset table, and every one of those is a source of scroll jump. A list that needs them is a different pattern, not an option on this one.
- Split the arithmetic from the component: the maths has the edge cases worth pinning and can be tested in a node environment, where the component's effects never run.

## Depends on

- [Component-first UI system (primitives/composites/layout, CVA, tokens)](/docs/pattern-library/ui-component-system)

---

_Machine-readable record: `virtualized-rendering` in `pattern-library/registry.json`._
