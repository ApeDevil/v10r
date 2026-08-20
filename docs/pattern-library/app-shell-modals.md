---
title: "Modals & layer stack"
description: "Manages a stacked layer of modals and dialogs (quick search, shortcuts help, session expiry) through a shared state module and dialog primitives."
category: "App Shell & Navigation"
---

# Modals & layer stack

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Manages a stacked layer of modals and dialogs (quick search, shortcuts help, session expiry) through a shared state module and dialog primitives.

**When to use:** Reach for it when opening a new modal that must coexist with, or stack above, other overlays.

## Docs

- [docs/blueprint/app-shell/shell-state.md](/docs/blueprint/app-shell/shell-state) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/shell-state.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/shell-state.md))

## Code

- `src/lib/state/modals.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/modals.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/modals.svelte.ts))
- `src/lib/components/primitives/dialog/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives/dialog) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives/dialog))

## Proof

- [`/showcases/shell/modals`](/showcases/shell/modals)

---

_Machine-readable record: `app-shell-modals` in `mcp/patterns.registry.json`._
