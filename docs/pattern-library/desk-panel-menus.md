---
title: "Composed panel menus"
description: "A context-scoped registry where each panel instance registers its command menus, composed with a dock-supplied Panel floor menu and View menu into one array…"
category: "Desk Workspace"
---

# Composed panel menus

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Desk Workspace · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — client-side menu state

A context-scoped registry where each panel instance registers its command menus, composed with a dock-supplied Panel floor menu and View menu into one array that the desktop kebab and the mobile commands sheet both render.

**When to use:** Use when per-panel commands must appear identically on multiple surfaces (desktop menus, mobile sheets, shortcut handlers) without each surface maintaining its own copy.

**Needs:** required relational-db (via desk-workspace)

## Docs

- `docs/blueprint/desk/README.md` — § Focus Architecture (registries are followers) + § Mobile Chrome (menu parity rule) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))

## Code

- `src/lib/components/desk/panel-menus.state.svelte.ts` — Context-scoped registry keyed by panel instance id — never module-level ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panel-menus.state.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panel-menus.state.svelte.ts))
- `src/lib/components/desk/compose-menus.ts` — composePanelMenus(): registered menus → Panel floor menu → View menu; drops empty registered menus ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/compose-menus.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/compose-menus.ts))
- `src/lib/components/desk/view-menu.ts` — buildViewMenu(actions) — desktop-only; the mobile sheet composes without it (the panels drawer projects View on touch) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/view-menu.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/view-menu.ts))

## Tests

- `src/lib/components/desk/compose-menus.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/compose-menus.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/compose-menus.test.ts))

## Proof

- [`/showcases/desk`](/showcases/desk)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Desk workspace](/docs/pattern-library/desk-workspace) — Each panel instance registers its menus with the dock that composes them.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.
- [Explosive Discovery — nested depth for dense menus and pages](/docs/pattern-library/explosive-discovery) — Menus, toolbars and command surfaces that offer many actions are reviewed against it (directions that narrow intent, an expert path beside every discovery path); latent cards apply it at the scale of one card.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `desk-panel-menus` in `pattern-library/registry.json`._
