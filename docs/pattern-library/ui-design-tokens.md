---
title: "Design tokens (breakpoints, fluid type/space, z-index)"
description: "Centralizes breakpoints, fluid typography/spacing clamp() scales, and z-index values in a single tokens.ts file consumed by the UnoCSS theme so no component…"
category: "UI Components & Design System"
---

# Design tokens (breakpoints, fluid type/space, z-index)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** UI Components & Design System · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend styling only

Centralizes breakpoints, fluid typography/spacing clamp() scales, and z-index values in a single tokens.ts file consumed by the UnoCSS theme so no component hardcodes design values.

**When to use:** Reach for this when adding or changing a spacing, breakpoint, typography, or stacking-order value that should be shared across the app.

## Docs

- [docs/blueprint/design/tokens.md](/docs/blueprint/design/tokens) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/tokens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/tokens.md))
- [docs/stack/ui/unocss.md](/docs/stack/unocss) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/ui/unocss.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/ui/unocss.md))

## Code

- `src/lib/styles/tokens.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/tokens.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/tokens.ts))
- `uno.config.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/uno.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/uno.config.ts))

## Proof

- [`/showcases/ui/tokens`](/showcases/ui/tokens)

---

_Machine-readable record: `ui-design-tokens` in `pattern-library/registry.json`._
