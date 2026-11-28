---
title: "Responsive sidebar"
description: "Implements an asymmetric responsive sidebar — a persistent hover-expanding rail on desktop and an off-canvas thumb-accessible drawer on mobile, triggered by a…"
category: "App Shell & Navigation"
---

# Responsive sidebar

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Implements an asymmetric responsive sidebar — a persistent hover-expanding rail on desktop and an off-canvas thumb-accessible drawer on mobile, triggered by a FAB.

**When to use:** Reach for it when adapting primary navigation to different viewport sizes or adjusting sidebar width/expand behavior.

**Needs:** v10r's implementation uses service-worker

## Docs

- [docs/blueprint/app-shell/sidebar.md](/docs/blueprint/app-shell/sidebar) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/sidebar.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/sidebar.md))

## Code

- `src/lib/components/shell/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/shell) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/shell))
- `src/lib/state/sidebar.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/sidebar.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/sidebar.svelte.ts))

## Proof

- [`/showcases/shell/sidebar`](/showcases/shell/sidebar)

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.

**Part of**

- [Shell layout](/docs/pattern-library/app-shell-layout) (required)


---

_Machine-readable record: `responsive-sidebar` in `pattern-library/registry.json`._
