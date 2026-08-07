---
title: "Quick Search / command palette (two-lane FTS)"
description: "A universal search combining an instant client-side lane with a debounced server-side full-text-search lane, surfaced via a Cmd+K command palette and a…"
category: "App Shell & Navigation"
---

# Quick Search / command palette (two-lane FTS)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Risk:** low — structural pattern, no external services

A universal search combining an instant client-side lane with a debounced server-side full-text-search lane, surfaced via a Cmd+K command palette and a dedicated /search page.

**When to use:** Reach for it when adding a new searchable surface (page, doc, showcase) or extending the command palette's result grouping.

## Docs

- [docs/blueprint/quick-search/architecture.md](/docs/blueprint/quick-search/architecture) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/quick-search/architecture.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/quick-search/architecture.md))

## Code

- `src/lib/components/composites/command-palette/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/command-palette) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/command-palette))
- `src/lib/server/search/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/search) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/search))

## Proof

- [`/search`](/search) (app route, no showcase)
- [`GET /api/search`](/api/search) (app route, no showcase)

---

_Machine-readable record: `app-shell-quick-search` in `mcp/patterns.registry.json`._
