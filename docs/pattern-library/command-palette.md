---
title: "Quick search command palette"
description: "A universal search combining an instant client-side lane with a debounced server-side full-text-search lane, surfaced via a Cmd+K command palette and a…"
category: "App Shell & Navigation"
---

# Quick search command palette

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

A universal search combining an instant client-side lane with a debounced server-side full-text-search lane, surfaced via a Cmd+K command palette and a dedicated /search page.

**When to use:** Reach for it when adding a new searchable surface (page, doc, showcase) or extending the command palette's result grouping.

**Needs:** v10r's implementation uses relational-db

## Docs

- [docs/blueprint/quick-search/architecture.md](/docs/blueprint/quick-search/architecture) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/quick-search/architecture.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/quick-search/architecture.md))

## Code

- `src/lib/components/composites/command-palette/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/command-palette) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/command-palette))
- `src/lib/server/search/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/search) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/search))

## Proof

- [`/search`](/search) (app route, no showcase)
- [`/api/search`](/api/search) (app route, no showcase) — GET

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.
- [Explosive Discovery — nested depth for dense menus and pages](/docs/pattern-library/explosive-discovery) — Menus, toolbars and command surfaces that offer many actions are reviewed against it (directions that narrow intent, an expert path beside every discovery path); latent cards apply it at the scale of one card.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.
- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `command-palette` in `pattern-library/registry.json`._
