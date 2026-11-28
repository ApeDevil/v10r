---
title: "Design tokens"
description: "Centralizes breakpoints, fluid typography/spacing clamp() scales, and z-index values in a single tokens.ts file consumed by the UnoCSS theme so no component…"
category: "UI Components & Design System"
---

# Design tokens

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** UI Components & Design System · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend styling only

Centralizes breakpoints, fluid typography/spacing clamp() scales, and z-index values in a single tokens.ts file consumed by the UnoCSS theme so no component hardcodes design values.

**When to use:** Reach for this when adding or changing a spacing, breakpoint, typography, or stacking-order value that should be shared across the app.

## Docs

- [docs/blueprint/design/tokens.md](/docs/blueprint/design/tokens) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/tokens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/tokens.md))
- [docs/stack/ui/unocss.md](/docs/stack/unocss) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/ui/unocss.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/ui/unocss.md))

## Code

- `src/lib/styles/tokens.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/tokens.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/tokens.ts))
- `uno.config.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/uno.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/uno.config.ts))
- `src/lib/components/primitives/typography/` — Typography — Typography primitive components applying the design system's fluid type scale and heading/body/UI/code character rules. Use for any heading, body, or code text that should follow the app's typographic scale instead of raw HTML tags. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives/typography) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives/typography))

## Proof

- [`/showcases/ui/tokens`](/showcases/ui/tokens)
- [`/showcases/ui/typography`](/showcases/ui/typography) — Typography

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `design-tokens` in `pattern-library/registry.json`._
