---
title: "Tonal (surface) elevation engine"
description: "A pure, SSR-safe TypeScript engine that computes each surface's relative depth (parent level + 1) via Svelte context and stamps it as a data-elevation…"
category: "UI Components & Design System"
---

# Tonal (surface) elevation engine

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** UI Components & Design System · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only, no runtime side effects

A pure, SSR-safe TypeScript engine that computes each surface's relative depth (parent level + 1) via Svelte context and stamps it as a data-elevation attribute, decoupled from z-index.

**When to use:** Use when a new stacked surface (menu, dialog, panel) needs a consistent tonal depth cue that survives Bits UI portals.

## Docs

- [docs/blueprint/design/tokens.md](/docs/blueprint/design/tokens) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/tokens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/tokens.md))

## Code

- `src/lib/styles/elevation.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/elevation.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/elevation.ts))
- `src/lib/components/layout/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/layout) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/layout))

## Proof

- [`/showcases/ui/layouts`](/showcases/ui/layouts)

---

_Machine-readable record: `ui-tonal-elevation` in `mcp/patterns.registry.json`._
