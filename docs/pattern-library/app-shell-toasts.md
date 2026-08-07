---
title: "Toasts (stacking, undo)"
description: "Ephemeral, stacking feedback messages (success/error/warning/info) shown in response to user-initiated actions, distinct from the persistent notification…"
category: "App Shell & Navigation"
---

# Toasts (stacking, undo)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Risk:** low — structural pattern, no external services

Ephemeral, stacking feedback messages (success/error/warning/info) shown in response to user-initiated actions, distinct from the persistent notification center.

**When to use:** Reach for it when giving immediate feedback for a user action such as a save, delete, or copy, optionally with an undo affordance.

## Docs

- [docs/blueprint/app-shell/toast.md](/docs/blueprint/app-shell/toast) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/toast.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/toast.md))

## Code

- `src/lib/components/composites/toast/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/toast) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/toast))
- `src/lib/state/toast.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/toast.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/toast.svelte.ts))

## Proof

- [`/showcases/shell/toasts`](/showcases/shell/toasts)

---

_Machine-readable record: `app-shell-toasts` in `mcp/patterns.registry.json`._
