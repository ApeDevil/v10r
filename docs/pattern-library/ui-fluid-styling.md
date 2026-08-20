---
title: "Fluid responsive styling (UnoCSS, container queries)"
description: "A UnoCSS-driven mobile-first strategy combining clamp()-based fluid typography/spacing, media-query breakpoints for page layout, and container queries for…"
category: "UI Components & Design System"
---

# Fluid responsive styling (UnoCSS, container queries)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** UI Components & Design System · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only

A UnoCSS-driven mobile-first strategy combining clamp()-based fluid typography/spacing, media-query breakpoints for page layout, and container queries for self-contained component responsiveness.

**When to use:** Apply when a component or page needs to scale smoothly across viewport sizes or respond to its own container rather than the viewport.

## Docs

- [docs/blueprint/design/styling.md](/docs/blueprint/design/styling) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/styling.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/styling.md))
- [docs/stack/ui/unocss.md](/docs/stack/unocss) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/ui/unocss.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/ui/unocss.md))

## Code

- `uno.config.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/uno.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/uno.config.ts))

## Proof

- [`/showcases/ui/typography`](/showcases/ui/typography) — Fluid type scale demo

---

_Machine-readable record: `ui-fluid-styling` in `mcp/patterns.registry.json`._
