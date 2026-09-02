---
title: "Shell layout (no global header, sidebar-first)"
description: "Defines the app shell's structural layout — a collapsible sidebar for primary navigation, a main content area, and a persistent footer, with no global header."
category: "App Shell & Navigation"
---

# Shell layout (no global header, sidebar-first)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Defines the app shell's structural layout — a collapsible sidebar for primary navigation, a main content area, and a persistent footer, with no global header.

**When to use:** Reach for it when building or modifying the top-level app shell wrapper or its breakpoint/z-index behavior.

## Docs

- [docs/blueprint/app-shell/layout.md](/docs/blueprint/app-shell/layout) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/layout.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/layout.md))

## Code

- `src/lib/components/shell/AppShell.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/AppShell.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/AppShell.svelte))

## Proof

- [`/showcases/shell`](/showcases/shell)

---

_Machine-readable record: `app-shell-layout` in `pattern-library/registry.json`._
