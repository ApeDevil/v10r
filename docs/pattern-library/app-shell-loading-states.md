---
title: "Loading states (skeletons, nav progress)"
description: "Defines visual feedback for initial load, navigation, data fetch, action, and streaming states using skeleton screens and a navigation progress bar."
category: "App Shell & Navigation"
---

# Loading states (skeletons, nav progress)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Risk:** low — structural pattern, no external services

Defines visual feedback for initial load, navigation, data fetch, action, and streaming states using skeleton screens and a navigation progress bar.

**When to use:** Reach for it when a page or component needs perceived-performance feedback while data or a route is loading.

## Docs

- [docs/blueprint/app-shell/loading-states.md](/docs/blueprint/app-shell/loading-states) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/loading-states.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/loading-states.md))

## Code

- `src/lib/components/primitives/skeleton/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives/skeleton) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives/skeleton))
- `src/lib/components/shell/NavigationProgress.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/NavigationProgress.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/NavigationProgress.svelte))

---

_Machine-readable record: `app-shell-loading-states` in `mcp/patterns.registry.json`._
