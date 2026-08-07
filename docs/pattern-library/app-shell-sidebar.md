---
title: "Responsive sidebar (rail / drawer / FAB)"
description: "Implements an asymmetric responsive sidebar — a persistent hover-expanding rail on desktop and an off-canvas thumb-accessible drawer on mobile, triggered by a…"
category: "App Shell & Navigation"
---

# Responsive sidebar (rail / drawer / FAB)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Risk:** low — structural pattern, no external services

Implements an asymmetric responsive sidebar — a persistent hover-expanding rail on desktop and an off-canvas thumb-accessible drawer on mobile, triggered by a FAB.

**When to use:** Reach for it when adapting primary navigation to different viewport sizes or adjusting sidebar width/expand behavior.

## Docs

- [docs/blueprint/app-shell/sidebar.md](/docs/blueprint/app-shell/sidebar) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/sidebar.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/sidebar.md))

## Code

- `src/lib/components/shell/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/shell) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/shell))
- `src/lib/state/sidebar.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/sidebar.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/sidebar.svelte.ts))

## Proof

- [`/showcases/shell/sidebar`](/showcases/shell/sidebar)

---

_Machine-readable record: `app-shell-sidebar` in `mcp/patterns.registry.json`._
