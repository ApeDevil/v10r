---
title: "Explosive Discovery — nested depth for dense menus and pages"
description: "A review heuristic, not a rule: when a menu, toolbar or page offers more than ~5 ± 2 simultaneous choices, structure capability as directions that narrow…"
category: "UI Components & Design System"
---

# Explosive Discovery — nested depth for dense menus and pages

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** UI Components & Design System · **Tier:** deep · **Maturity:** proven (verified 2026-09-18 @ b9287328-dirty) · **Risk:** low — a review heuristic and pure composition code; no persistence, no external services

A review heuristic, not a rule: when a menu, toolbar or page offers more than ~5 ± 2 simultaneous choices, structure capability as directions that narrow intent (Overview → Direction → Context → Action → Detail), promote actions by context, keep an expert path beside every discovery path, and project one semantic hierarchy per device. The desk's panel menus embody it: one composed array rendered as desktop sub-menus and as a flat mobile sheet, with shortcuts declared on the same items.

**When to use:** Reviewing or designing any menu, toolbar, context menu, sidebar or command surface that has grown past a handful of unrelated actions — and deciding whether the answer is grouping, context promotion, a shortcut, or leaving it flat.

## Docs

- [docs/blueprint/design/explosive-discovery.md](/docs/blueprint/design/explosive-discovery) — The heuristic: objective, choice trigger, context first, projections, review signals, output shape, invariants ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/explosive-discovery.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/explosive-discovery.md))
- `docs/blueprint/design/README.md` — Design principle 3 (progressive disclosure) — what this heuristic refines ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/README.md))

## Code

- `src/lib/components/desk/compose-menus.ts` — One composed menu array for every projection; the Panel floor menu promotes Switch-to / Close-others only when siblings exist ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/compose-menus.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/compose-menus.ts))
- `src/lib/components/desk/view-menu.ts` — The dock-level View menu, desktop-only: the mobile sheet and the keyboard matcher below the breakpoint compose with viewMenu: null because the panels drawer already projects those commands on touch — a projection rule, not a second menu. Its toggle rows derive from the activity-bar items that declare a chord, so bar tooltip and menu row are one declaration ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/view-menu.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/view-menu.ts))
- `src/lib/components/desk/DockLeafMenu.svelte` — Desktop projection: kebab → one sub-menu per direction ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/DockLeafMenu.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/DockLeafMenu.svelte))
- `src/lib/components/desk/DockMobileCommandsDrawer.svelte` — Mobile projection: the same array as flat titled sections (hover sub-menus are hostile to touch) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/DockMobileCommandsDrawer.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/DockMobileCommandsDrawer.svelte))
- `src/lib/components/desk/DeskShortcuts.svelte` — Expert path derived from the discovery path: shortcuts matched against the composed menus, never a parallel table — and matched inside the editor's textarea, where the chord is needed ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/DeskShortcuts.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/DeskShortcuts.svelte))
- `src/lib/components/desk/panels/explorer/context-menu-items.ts` — Capability-gated builder — availability ≠ visibility; groups Open → AI context → Edit → Type-specific → Create → Destructive and omits empty groups ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/explorer/context-menu-items.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/explorer/context-menu-items.ts))
- `src/lib/components/composites/selection-bar/` — Context promotion: a toolbar that exists only while a selection does ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/selection-bar) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/selection-bar))

## Tests

- `src/lib/components/desk/compose-menus.test.ts` — Pins the projection invariants (View appended only where a projection passes one; the floor menu is never empty; the About table derives from the array) — not the heuristic's UX efficacy ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/compose-menus.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/compose-menus.test.ts))

## Proof

- [`/desk`](/desk) (app route, no showcase) — Open a panel's kebab on desktop, then the ⋮ commands sheet on a phone: same commands, two projections
- [`/showcases/ui/menus`](/showcases/ui/menus) — The forms a direction can take: dropdown, context menu, menu bar, overflow, selection bar, command palette

## Invariants

- Availability is not visibility: the capability model stays explicit (what can be done) and the page decides what to show now; hiding never removes a capability from the model.
- Every projection (desktop, mobile, keyboard) renders the same composed capability set — only the arrangement differs; a command present on one and absent on another is a bug, not an adaptation.
- Every discovery path has an expert path — a shortcut, palette entry or recent — declared beside the menu item, never in a second table that can drift.
- Context promotion is temporary: an action surfaced by state (selection, dirty, siblings) returns to its depth when the state ends.
- ~5 ± 2 simultaneous primary choices is a review trigger, never a limit; a flat list stays flat when it is familiar, scannable, repeated, or a comparison.

## Emulation notes

- Build the menu as data first — one pure compose function over registered menus plus a floor menu — then render each projection from that array; test the projection rules (what mobile strips) in the pure function, not in components.
- Gate items by a capability Set on the object and let the builder omit empty groups; the menu never learns node types.
- Declare `shortcut` on the menu item and match keyboard events against the same array; never register the same commands in a second global table.
- Nest by narrowing intent (Place → When / Where / Map), never because a menu is long; a 'More' bucket of leftovers is the anti-pattern the heuristic exists to catch.
- Review with the five-part output (Observation / Reasoning / Opportunity / Possible Direction / Trade-off) and its advisory language; a finding is mandatory only when another requirement makes it so.

---

_Machine-readable record: `ui-explosive-discovery` in `pattern-library/registry.json`._
