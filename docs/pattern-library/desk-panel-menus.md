---
title: "Composed panel menus (one array, desktop kebab + mobile sheet)"
description: "A context-scoped registry where each panel instance registers its command menus, composed with a dock-supplied Panel floor menu and View menu into one array…"
category: "Desk Workspace"
---

# Composed panel menus (one array, desktop kebab + mobile sheet)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Desk Workspace · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — client-side menu state

A context-scoped registry where each panel instance registers its command menus, composed with a dock-supplied Panel floor menu and View menu into one array that the desktop kebab and the mobile commands sheet both render.

**When to use:** Use when per-panel commands must appear identically on multiple surfaces (desktop menus, mobile sheets, shortcut handlers) without each surface maintaining its own copy.

## Docs

- `docs/blueprint/desk/README.md` — § Focus Architecture (registries are followers) + § Mobile Chrome (menu parity rule) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))

## Code

- `src/lib/components/composites/dock/panel-menus.svelte.ts` — Context-scoped registry keyed by panel instance id — never module-level ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/panel-menus.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/panel-menus.svelte.ts))
- `src/lib/components/composites/dock/compose-menus.ts` — composePanelMenus(): registered menus → Panel floor menu → View menu; drops empty registered menus ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/compose-menus.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/compose-menus.ts))
- `src/lib/components/composites/dock/view-menu.ts` — buildViewMenu({ structural }) — mobile strips split commands ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/view-menu.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/view-menu.ts))

## Tests

- `src/lib/components/composites/dock/compose-menus.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/compose-menus.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/compose-menus.test.ts))

## Proof

- [`/desk`](/desk) (app route, no showcase)

## Depends on

- [Desk workspace (dock layout, focus architecture, mobile projection)](/docs/pattern-library/desk-workspace)

---

_Machine-readable record: `desk-panel-menus` in `mcp/patterns.registry.json`._
