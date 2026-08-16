---
title: "Desk workspace (dock layout, focus architecture, mobile projection)"
description: "A full-page multi-panel workspace on a binary split-tree dock: resizable panes, drag-and-drop tabs, a panel-type registry, typed cross-panel pub/sub…"
category: "Desk Workspace"
---

# Desk workspace (dock layout, focus architecture, mobile projection)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Desk Workspace · **Tier:** deep · **Risk:** medium — persists workspace layout locally and via the file registry; no cross-user surface

A full-page multi-panel workspace on a binary split-tree dock: resizable panes, drag-and-drop tabs, a panel-type registry, typed cross-panel pub/sub (DeskBus), one persisted desktop tree with total focus derivation, and a mobile chrome that is a projection over the same state — never a second layout.

**When to use:** Use for IDE-like authoring surfaces where several content types (editor, explorer, spreadsheet, AI bot) must coexist, communicate, and stay AI-drivable — and where the same workspace must work on phones without forking its state model.

## Docs

- `docs/blueprint/desk/README.md` — The hub: focus architecture, desk effect contract, mobile chrome, Explorer, DeskBus channels ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))
- `docs/blueprint/desk/spreadsheet.md` — How a new file-backed panel type joins the workspace ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/spreadsheet.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/spreadsheet.md))

## Code

- `src/lib/components/composites/dock/` — The whole composite: DockLayout, leaves, tab bars, mobile chrome, state modules ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/dock) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/dock))
- `src/lib/components/composites/dock/dock.state.svelte.ts` — Split-tree state: total focus derivation (focusedLeafId → first non-empty leaf fallback), focusSeq counter ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/dock.state.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/dock.state.svelte.ts))
- `src/lib/components/composites/dock/dock.operations.ts` — Pure tree math (split/remove/move) — kept side-effect-free and unit-tested as such ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/dock.operations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/dock.operations.ts))
- `src/lib/components/composites/dock/panel-actions.ts` — focusPanel() — the single focus writer every activation path goes through (tabs, drawer rows, AI effects, deep links) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/panel-actions.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/panel-actions.ts))
- `src/lib/components/composites/dock/desk-bus.svelte.ts` — Typed pub/sub channels between panels (context-scoped factory, not module state) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/desk-bus.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/desk-bus.svelte.ts))
- `src/lib/server/desk/` — File registry domain module + DockLayoutState valibot schemas ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/desk) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/desk))

## Tests

- `src/lib/components/composites/dock/dock.operations.test.ts` — Tree-op purity ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/dock.operations.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/dock.operations.test.ts))
- `src/lib/components/composites/dock/dock.state.focus.svelte.test.ts` — Total focus derivation, fallback, focusSeq ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/dock/dock.state.focus.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/dock/dock.state.focus.svelte.test.ts))
- `src/lib/server/desk/schemas.parity.test.ts` — Gates DockLayoutState ↔ valibot schema key parity ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/desk/schemas.parity.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/desk/schemas.parity.test.ts))

## Proof

- [`/desk`](/desk) (app route, no showcase)
- [`/showcases/ui/workbench`](/showcases/ui/workbench) — The same DockLayout embedded in a Card with mobileChrome="bar" — proves the composite is not /desk-specific

## Invariants

- The persisted DockLayoutState is always the desktop tree; mobile is a projection over it — mobile paths may focus, open, or close panels, never split or resize.
- Exactly one focused panel per dock instance on every surface. Menus, AI page context, and the mobile visible panel all derive from it; every activation path writes through focusPanel().
- Every DockLayoutState field must exist in DockLayoutStateSchema in the same commit — valibot strips unknown keys silently, so a missed field diverges the DB lane without an error.
- No module-level $state for per-dock-instance concerns (panel menus, mobile surfaces) — context-scope them so two dock instances on one page cannot cross-talk. Singleton-ness follows the resource: per-tab resources like the visual viewport may be module singletons.
- Desktop panel kebab and mobile commands sheet render the same composePanelMenus() array — a difference between them is a bug.
- A desk effect that surfaces a panel leaves it visible without further interaction — overlay auto-close (focusSeq) is part of the effect, not a courtesy.

## Emulation notes

- Build the tree math as pure functions over a plain node type first (dock.operations.ts) and test it in isolation; wire reactivity in a separate .svelte.ts state class.
- Vitest's node environment compiles Svelte in SERVER mode: factory-scoped $derived evaluates once and freezes. Any derived state you want to unit-test must be a plain function reading $state sources.
- Make focus total, not optional: the stored focusedLeafId if it still resolves, else the first non-empty leaf. Consumers never handle a 'nothing focused' state while panels exist.
- Bump a monotonic focusSeq on every focus write, repeats included — overlays close by watching it, which makes 'AI focused the already-visible panel' still dismiss the drawer.
- Keep closed panels in the panels registry (only the tree entry is removed) — that is what makes close-undo a cheap re-attach instead of a state reconstruction.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `desk-workspace` in `mcp/patterns.registry.json`._
