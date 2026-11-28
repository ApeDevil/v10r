---
title: "Desk mobile chrome"
description: "Phone chrome for the dock workspace: a scrollable top tab strip of open panel instances, a bottom-right controls pill (commands sheet + panels drawer) sitting…"
category: "Desk Workspace"
---

# Desk mobile chrome

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Desk Workspace · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend chrome over existing workspace state

Phone chrome for the dock workspace: a scrollable top tab strip of open panel instances, a bottom-right controls pill (commands sheet + panels drawer) sitting left of the app FAB via slot tokens, and a soft-keyboard watcher that hides floating chrome while typing.

**When to use:** Use when a desktop multi-panel workspace must work on phones without forking its layout state — the chrome only focuses, opens, and closes panels on the persisted desktop tree.

**Needs:** required relational-db (via desk-workspace)

## Docs

- `docs/blueprint/desk/README.md` — § Mobile Chrome — control mapping, menu parity, keyboard hiding ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))

## Code

- `src/lib/components/desk/DockMobileTabs.svelte` — Open-instance tab strip; taps go through focusPanel ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/DockMobileTabs.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/DockMobileTabs.svelte))
- `src/lib/components/desk/dock-mobile.state.svelte.ts` — Context-scoped surface discriminator ('panels' | 'commands' | null) + focusSeq auto-close ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/dock-mobile.state.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/dock-mobile.state.svelte.ts))
- `src/lib/state/visual-viewport.svelte.ts` — rAF-coalesced visualViewport watcher with hysteresis → --keyboard-inset + data-keyboard on <html> ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/visual-viewport.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/visual-viewport.svelte.ts))

## Tests

- `src/lib/state/visual-viewport.svelte.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/visual-viewport.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/visual-viewport.svelte.test.ts))

## Proof

- [`/showcases/desk`](/showcases/desk)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Desk workspace](/docs/pattern-library/desk-workspace) — Phone chrome for the workspace’s dock and its open panel instances.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.
- [Explosive Discovery — nested depth for dense menus and pages](/docs/pattern-library/explosive-discovery) — Menus, toolbars and command surfaces that offer many actions are reviewed against it (directions that narrow intent, an expert path beside every discovery path); latent cards apply it at the scale of one card.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `desk-mobile-chrome` in `pattern-library/registry.json`._
