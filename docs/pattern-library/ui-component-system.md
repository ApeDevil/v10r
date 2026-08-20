---
title: "Component-first UI system (primitives/composites/layout, CVA, tokens)"
description: "A layered component system — Bits UI → primitives (styled atoms) → composites (business logic) → layout (structural wrappers) — styled entirely through CVA →…"
category: "UI Components & Design System"
---

# Component-first UI system (primitives/composites/layout, CVA, tokens)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** UI Components & Design System · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only

A layered component system — Bits UI → primitives (styled atoms) → composites (business logic) → layout (structural wrappers) — styled entirely through CVA → UnoCSS → design-token CSS variables.

**When to use:** Emulate when a project needs consistent UI at any scale: the layer split keeps styling decisions in one place and bans ad-hoc HTML.

## Docs

- `docs/blueprint/design/README.md` — Design philosophy hub ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/README.md))
- [docs/blueprint/design/components.md](/docs/blueprint/design/components) — Layer system and CVA variant rules ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/components.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/components.md))
- [docs/blueprint/design/tokens.md](/docs/blueprint/design/tokens) — Token architecture (breakpoints, fluid type/space, elevation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/tokens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/tokens.md))
- [docs/blueprint/design/styling.md](/docs/blueprint/design/styling) — Styling flow and layout primitives ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/styling.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/styling.md))

## Code

- `src/lib/components/primitives/` — ~40 styled atoms wrapping Bits UI ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives))
- `src/lib/components/composites/` — Components with business logic ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites))
- `src/lib/components/layout/` — Structural wrappers (Stack, Cluster, Surface) ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/layout) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/layout))
- `src/lib/styles/tokens.ts` — Design tokens ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/tokens.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/tokens.ts))
- `uno.config.ts` — UnoCSS theme wiring ([GitHub](https://github.com/ApeDevil/v10r/blob/main/uno.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/uno.config.ts))

## Tests

- `src/lib/components/composites/dock/dock.operations.test.ts` — Example colocated component test ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/dock.operations.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/dock.operations.test.ts))

## Proof

- [`/showcases/ui/components`](/showcases/ui/components)
- [`/showcases/ui/layouts`](/showcases/ui/layouts)
- [`/showcases/ui/tokens`](/showcases/ui/tokens)

## Invariants

- Never use raw HTML elements when a project component exists — raw <input>/<button>/<select> bypass the design system.
- Styling flows through CVA → UnoCSS utilities → token-backed CSS variables; components never hardcode colors or spacing.
- Components are zero-margin; layout is gap-based on the spacing scale.

## Emulation notes

- Adopt the layer vocabulary first (primitive/composite/layout) — it decides where every new component goes.
- Port the token file before porting any component; components without tokens re-create the ad-hoc styling problem.

---

_Machine-readable record: `ui-component-system` in `mcp/patterns.registry.json`._
