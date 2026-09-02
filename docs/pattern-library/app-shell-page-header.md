---
title: "Page header (per-page, XSS-safe)"
description: "A per-page header component (breadcrumbs, title, actions) rendered inside the main content area instead of a global header, keeping page-specific chrome…"
category: "App Shell & Navigation"
---

# Page header (per-page, XSS-safe)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

A per-page header component (breadcrumbs, title, actions) rendered inside the main content area instead of a global header, keeping page-specific chrome scoped and safe against XSS.

**When to use:** Reach for it when a page needs a title, breadcrumbs, or action buttons without adding a site-wide header.

## Docs

- [docs/blueprint/app-shell/page-header.md](/docs/blueprint/app-shell/page-header) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/page-header.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/page-header.md))

## Code

- `src/lib/components/composites/page-header/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/page-header) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/page-header))

## Proof

- [`/showcases/shell`](/showcases/shell) — The shell showcase demonstrates the page chrome PageHeader anchors

---

_Machine-readable record: `app-shell-page-header` in `pattern-library/registry.json`._
