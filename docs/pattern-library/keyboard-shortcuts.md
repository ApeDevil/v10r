---
title: "Keyboard shortcuts registry + help modal"
description: "A central registry of global, navigation, and contextual keyboard shortcuts (e.g. Cmd+K for search, ? for help) surfaced through a discoverable help modal."
category: "App Shell & Navigation"
---

# Keyboard shortcuts registry + help modal

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

A central registry of global, navigation, and contextual keyboard shortcuts (e.g. Cmd+K for search, ? for help) surfaced through a discoverable help modal.

**When to use:** Reach for it when adding a new keyboard shortcut or needing conflict-free discoverability across the app shell.

## Docs

- [docs/blueprint/app-shell/keyboard-shortcuts.md](/docs/blueprint/app-shell/keyboard-shortcuts) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/keyboard-shortcuts.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/keyboard-shortcuts.md))

## Code

- `src/lib/shortcuts/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/shortcuts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/shortcuts))
- `src/lib/components/shell/ShortcutsDialog.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/ShortcutsDialog.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/ShortcutsDialog.svelte))

## Proof

- [`/showcases/shell/shortcuts`](/showcases/shell/shortcuts)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Modals & layer stack](/docs/pattern-library/modal-layer-stack) — The help modal opens on the shared modal layer stack.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.
- [Explosive Discovery — nested depth for dense menus and pages](/docs/pattern-library/explosive-discovery) — Menus, toolbars and command surfaces that offer many actions are reviewed against it (directions that narrow intent, an expert path beside every discovery path); latent cards apply it at the scale of one card.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `keyboard-shortcuts` in `pattern-library/registry.json`._
