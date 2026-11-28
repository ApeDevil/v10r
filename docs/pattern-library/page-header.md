---
title: "Page header"
description: "A per-page header component (breadcrumbs, title, actions) rendered inside the main content area instead of a global header, keeping page-specific chrome…"
category: "App Shell & Navigation"
---

# Page header

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

A per-page header component (breadcrumbs, title, actions) rendered inside the main content area instead of a global header, keeping page-specific chrome scoped and safe against XSS.

**When to use:** Reach for it when a page needs a title, breadcrumbs, or action buttons without adding a site-wide header.

## Docs

- [docs/blueprint/app-shell/page-header.md](/docs/blueprint/app-shell/page-header) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/page-header.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/page-header.md))

## Code

- `src/lib/components/composites/page-header/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/page-header) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/page-header))

## Proof

- [`/showcases/shell`](/showcases/shell) — The shell showcase demonstrates the page chrome PageHeader anchors

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.

**Part of**

- [Shell layout](/docs/pattern-library/app-shell-layout) (required)


---

_Machine-readable record: `page-header` in `pattern-library/registry.json`._
