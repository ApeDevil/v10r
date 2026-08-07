---
title: "Keyboard shortcuts registry + help modal"
description: "A central registry of global, navigation, and contextual keyboard shortcuts (e.g. Cmd+K for search, ? for help) surfaced through a discoverable help modal."
category: "App Shell & Navigation"
---

# Keyboard shortcuts registry + help modal

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Risk:** low — structural pattern, no external services

A central registry of global, navigation, and contextual keyboard shortcuts (e.g. Cmd+K for search, ? for help) surfaced through a discoverable help modal.

**When to use:** Reach for it when adding a new keyboard shortcut or needing conflict-free discoverability across the app shell.

## Docs

- [docs/blueprint/app-shell/keyboard-shortcuts.md](/docs/blueprint/app-shell/keyboard-shortcuts) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/keyboard-shortcuts.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/keyboard-shortcuts.md))

## Code

- `src/lib/shortcuts/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/shortcuts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/shortcuts))
- `src/lib/components/shell/ShortcutsModal.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/ShortcutsModal.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/ShortcutsModal.svelte))

## Proof

- [`/showcases/shell/shortcuts`](/showcases/shell/shortcuts)

---

_Machine-readable record: `app-shell-keyboard-shortcuts` in `mcp/patterns.registry.json`._
