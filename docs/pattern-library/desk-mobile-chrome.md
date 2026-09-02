---
title: "Desk mobile chrome (tab strip + pill + drawers)"
description: "Phone chrome for the dock workspace: a scrollable top tab strip of open panel instances, a bottom-right controls pill (commands sheet + panels drawer) sitting…"
category: "Desk Workspace"
---

# Desk mobile chrome (tab strip + pill + drawers)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Desk Workspace · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend chrome over existing workspace state

Phone chrome for the dock workspace: a scrollable top tab strip of open panel instances, a bottom-right controls pill (commands sheet + panels drawer) sitting left of the app FAB via slot tokens, and a soft-keyboard watcher that hides floating chrome while typing.

**When to use:** Use when a desktop multi-panel workspace must work on phones without forking its layout state — the chrome only focuses, opens, and closes panels on the persisted desktop tree.

## Docs

- `docs/blueprint/desk/README.md` — § Mobile Chrome — control mapping, menu parity, keyboard hiding ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))

## Code

- `src/lib/components/desk/DockMobileTabs.svelte` — Open-instance tab strip; taps go through focusPanel ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/DockMobileTabs.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/DockMobileTabs.svelte))
- `src/lib/components/desk/dock-mobile.state.svelte.ts` — Context-scoped surface discriminator ('panels' | 'commands' | null) + focusSeq auto-close ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/dock-mobile.state.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/dock-mobile.state.svelte.ts))
- `src/lib/state/visual-viewport.svelte.ts` — rAF-coalesced visualViewport watcher with hysteresis → --keyboard-inset + data-keyboard on <html> ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/visual-viewport.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/visual-viewport.svelte.ts))

## Tests

- `src/lib/state/visual-viewport.svelte.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/visual-viewport.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/visual-viewport.svelte.test.ts))

## Proof

- [`/desk`](/desk) (app route, no showcase)

## Depends on

- [Desk workspace (dock layout, focus architecture, mobile projection)](/docs/pattern-library/desk-workspace)

---

_Machine-readable record: `desk-mobile-chrome` in `pattern-library/registry.json`._
