# Component-first UI system

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** UI Components & Design System · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only

A layered component system — Bits UI → primitives (styled atoms) → composites (business logic) → layout (structural wrappers) — styled entirely through CVA → UnoCSS → design-token CSS variables.

**When to use:** Emulate when a project needs consistent UI at any scale: the layer split keeps styling decisions in one place and bans ad-hoc HTML.

## Avoid when

- A non-Svelte frontend — every primitive wraps Bits UI, which is Svelte-native and the layer system depends on it
- A project committed to a Tailwind theme config or another styled kit — token CSS variables are core to theming and hard to reverse

## Alternatives

- **Radix or Headless UI primitives under the same CVA + token layering** — prefer when the frontend is React or Vue rather than Svelte
- **Tailwind with its theme config instead of UnoCSS + CSS-variable tokens** — prefer when a larger ecosystem and documentation matter more than build speed and the app needs no runtime theming or rebuild-free dark mode

## Docs

- `docs/blueprint/design/README.md` — Design philosophy hub ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/README.md))
- `docs/blueprint/design/components.md` — Layer system and CVA variant rules ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/components.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/components.md))
- `docs/blueprint/design/tokens.md` — Token architecture (breakpoints, fluid type/space, elevation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/tokens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/tokens.md))
- `docs/blueprint/design/styling.md` — Styling flow and layout primitives ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/styling.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/styling.md))
- `docs/stack/ui/bits-ui.md` — UI primitives — Roughly 40 styled atomic components (Button, Input, Badge, Select, Table, etc.) that wrap Bits UI headless primitives with CVA variants and design tokens. Use as the base building block for a new UI element instead of styling a Bits UI primitive directly. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/ui/bits-ui.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/ui/bits-ui.md))

## Code

- `src/lib/components/primitives/` — ~40 styled atoms wrapping Bits UI ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives))
- `src/lib/components/composites/` — Components with business logic ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites))
- `src/lib/components/layout/` — Structural wrappers (Stack, Cluster, Surface) · Layout primitives — Structural wrapper components (Stack, Cluster, Surface, PageContainer) that provide consistent spacing and layout without one-off CSS. Use to arrange child elements with consistent gaps and structure instead of writing bespoke flex/grid CSS on every page. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/layout) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/layout))
- `src/lib/styles/tokens.ts` — Design tokens ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/tokens.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/tokens.ts))
- `uno.config.ts` — UnoCSS theme wiring ([GitHub](https://github.com/ApeDevil/v10r/blob/main/uno.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/uno.config.ts))
- `src/lib/components/primitives/table/` — Tables — A styled table primitive built on the primitives layer for rendering tabular data consistently across the app. Use when displaying structured, row-based data anywhere in the UI. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives/table) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives/table))
- `src/lib/components/composites/dropdown-menu/` — Menus — Dropdown menu, context menu, and menu bar composites built on Bits UI for triggerable and right-click action lists. Use when exposing a list of actions from a trigger button, right-click, or an app-level menu bar. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/dropdown-menu) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/dropdown-menu))
- `src/lib/components/composites/context-menu/` — Menus ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/context-menu) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/context-menu))
- `src/lib/components/composites/menu-bar/` — Menus ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/menu-bar) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/menu-bar))
- `src/lib/components/primitives/pane/` — Split panes — Resizable and reorderable split-pane primitives and composites for dividing screen space into adjustable regions. Use when a layout needs user-resizable or drag-reorderable panes, such as a multi-pane workspace. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives/pane) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives/pane))
- `src/lib/components/composites/reorderable-panes/` — Split panes ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/reorderable-panes) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/reorderable-panes))

## Tests

- `src/lib/components/desk/dock.state.svelte.test.ts` — Example colocated component test ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/dock.state.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/dock.state.svelte.test.ts))

## Proof

- [`/showcases/ui/components`](https://www.v10r.dev/showcases/ui/components)
- [`/showcases/ui/layouts`](https://www.v10r.dev/showcases/ui/layouts)
- [`/showcases/ui/tokens`](https://www.v10r.dev/showcases/ui/tokens)
- [`/showcases/ui/components/primitives`](https://www.v10r.dev/showcases/ui/components/primitives) — UI primitives
- [`/showcases/ui/components/composites`](https://www.v10r.dev/showcases/ui/components/composites) — Composites — Higher-level components (Card, FormField, CommandPalette, Chatbot, Dock, etc.) composed from primitives that add business logic and feature behavior. Use when a UI need spans more than one primitive and carries app-specific behavior or layout.
- [`/showcases/ui/tables`](https://www.v10r.dev/showcases/ui/tables) — Tables
- [`/showcases/ui/menus`](https://www.v10r.dev/showcases/ui/menus) — Menus
- [`/showcases/ui/splits`](https://www.v10r.dev/showcases/ui/splits) — Split panes

## Invariants

- Never use raw HTML elements when a project component exists — raw <input>/<button>/<select> bypass the design system.
- Styling flows through CVA → UnoCSS utilities → token-backed CSS variables; components never hardcode colors or spacing.
- Components are zero-margin; layout is gap-based on the spacing scale.

## Emulation notes

- Adopt the layer vocabulary first (primitive/composite/layout) — it decides where every new component goes.
- Port the token file before porting any component; components without tokens re-create the ad-hoc styling problem.

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/design-philosophy.md) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Built on by**

- [Generative UI](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/generative-ui.md)


---

_Machine-readable record: `component-system` in `pattern-library/registry.json`._
