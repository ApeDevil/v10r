---
title: "Empty states"
description: "Standardizes the anatomy (icon, title, description, action) for UI shown when there is no data — first-run, zero search results, deleted content, or error…"
category: "App Shell & Navigation"
---

# Empty states

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Standardizes the anatomy (icon, title, description, action) for UI shown when there is no data — first-run, zero search results, deleted content, or error recovery.

**When to use:** Reach for it when a list, search, or page has no data to render and needs a first-run or zero-result affordance instead of a blank screen.

## Docs

- [docs/blueprint/app-shell/empty-states.md](/docs/blueprint/app-shell/empty-states) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/empty-states.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/empty-states.md))

## Code

- `src/lib/components/composites/empty-state/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/empty-state) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/empty-state))

## Proof

- [`/showcases/ui/components/composites`](/showcases/ui/components/composites) — EmptyState in the feedback section

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `empty-states` in `pattern-library/registry.json`._
