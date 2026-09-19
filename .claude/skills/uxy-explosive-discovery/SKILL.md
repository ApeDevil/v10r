---
name: uxy-explosive-discovery
description: Review a dense menu, kebab, context menu, toolbar, sidebar, command palette or settings page for choice load and structure with the Explosive Discovery heuristic (nested depth — directions that narrow intent, context promotion, an expert path beside every discovery path, one hierarchy per viewport). Use whenever a surface has grown past a handful of unrelated actions, before adding one more action to an already dense one, or when someone says "too many buttons", "long menu", "where is X", "hidden feature", "More menu", "overflow", "submenu", or "the mobile menu is just the desktop one". Output is advisory (Observation / Reasoning / Opportunity / Possible Direction / Trade-off) — never a rule, never an edit.
metadata:
  family: uxy
---

# Reviewing a surface for Explosive Discovery

The principle lives in `docs/blueprint/design/explosive-discovery.md` — read it once. This file is the procedure: what to look at, in what order, and what to emit. The heuristic is advisory; a finding becomes mandatory only when another requirement (accessibility, a product rule) makes it so. Not Progressive Revelation (that is journey-stage content gating, planned); this is choice structure on one page at one moment.

**Keywords**: menu, kebab, overflow, context menu, toolbar, sidebar, palette, submenu, "More", shortcuts, mobile sheet, choice load.

## Entry ladder — ask in this order, stop at the first "no"

1. Does the user need to understand all of these choices right now? *(no → the review is "direct exposure is right here"; write it up and stop)*
2. Can several actions be represented as meaningful directions?
3. Does entering a direction naturally reveal the next level of detail?
4. Can experienced users still reach the common actions efficiently?

## Collect evidence per surface

| Evidence | How to get it | Where it usually is |
|---|---|---|
| Max simultaneous items at the densest state | count the rendered set for the richest object/state, not the union of all branches | the builder / composer, its gating inputs |
| Grouping mechanism | separators, sub-menus, titled sections, tabs | the menu data, not the component |
| Gating | capability sets, state flags, permissions that omit items | adapters, `$derived` inputs, `when` guards |
| Context-promoted items | items that exist only while a state holds (dirty, selection, siblings) | conditional spreads in the composer |
| Expert-path coverage | which items declare a shortcut; are they listed where users look for shortcuts (`shift+/`, palette); does the chord fire from the element the task keeps focus in (a textarea guard kills it) | `shortcut` fields, the shortcuts registry, palette items, the matcher's early returns |
| Mobile projection | same set as desktop? nested or flat? anything silently dropped — or reachable only by hardware keyboard? | the mobile host of the same data, and what mounts outside the branch |
| Third projections | hand-built menus and header icons beside the composed array (a tab's right-click, a gear in an input): do they print the chord they mirror, mint their own ids, record nothing? | `grep` the command's handler for callers outside the composer |
| Sink, not emitter | when a fix adds a sensor (telemetry, a setting), follow it to the table or the media query — an emitter the server drops is no evidence | the collect policy, the endpoint's filters, the projection's `data-*` |
| Anchors | `path:line` for every count and claim | — |

## The choice trigger

~5 ± 2 simultaneous primary choices — convention, not law. It is a reason to look, never a cap.

| More is fine when | Fewer is better when |
|---|---|
| familiar · scannable · a comparison · exploratory · repeated direct access · nesting would slow the work | the decision needs interpretation · the user is new · one or two actions dominate · a wrong choice is costly |

## Detection table

| Signal | Look for | Usual direction |
|---|---|---|
| Unrelated actions compete at once | a flat list with no grouping by meaning | semantic compression into directions |
| Common and rare share prominence | Delete beside Edit at equal weight | prominence by frequency and cost, not nesting |
| Implementation concepts leak | labels naming tables, modules, flags | rename the decision, then group |
| Long flat menu accumulating | one row per feature ever added | directions; keep the top 5 ± 2 flat |
| Variations of one decision | verbs sharing an object (Start / End / Duration) | one direction (Time) |
| Capability hard to discover | depth with no continuation signal | category label, "…" indicator, search, palette entry |
| Repeated traversal of the same nesting | a two-hop path to a daily action | expert path (shortcut, recent, quick action) or promotion |
| "More" as a dumping ground | a bucket whose items share nothing | dissolve into real directions |
| Hierarchy follows architecture | menus named after modules | regroup by user meaning |
| Mobile merely compresses desktop | hover sub-menus on touch; commands missing on one projection | one composed set, a projection per device |
| Context known but unused | selection / dirty / siblings state exists, prominence unchanged | temporary promotion |
| Disclosure taxes a common workflow | the happy path gained a click | flatten that action, keep depth for the rest |

## What NOT to flag

- Small sets, familiar tools, comparison views, dashboards, expert consoles, repetitive table work — scanning beats navigating there.
- A capability-gated menu whose *union* is long but whose *rendered* set is not (the desk explorer: 13 possible, ≤ 7 per node).
- The desk's kebab ↔ mobile sheet parity (`composePanelMenus()` → sub-menus on desktop, flat titled sections on mobile): that is the reference, not a finding.
- A count alone. Without a reasoning line about frequency, context and cost, the number is not evidence.

## Output shape

One block per surface. Every block carries an anchor, a hand-off and a size, so it can be acted on or declined without re-reading the code.

```markdown
### <surface> — `path:line` [viewport]
- Observation: the surface and the simultaneous choices it presents (counts at the densest state)
- Reasoning: context, semantic relationships, frequency, discoverability, interaction cost
- Opportunity: grouping · prioritization · disclosure · context promotion · flattening — or "none — direct exposure is right here"
- Possible Direction: a concrete arrangement, with real labels
- Trade-off: what it makes better; what it makes worse
- Evidence: `path:line`, counts, gating, shortcut coverage
- Hand-off: uxy (promotion / grouping) · laly (viewport projection) · cony (direction labels) · arty (look) · user
- Size: small · medium · large
```

## Language

| Say | Never say |
|---|---|
| Consider… · This may benefit from… · Review whether… | This violates Nested Depth. |
| A possible semantic grouping is… | There are too many actions. |
| This action may deserve contextual promotion… | A maximum of seven choices is allowed. |
| This hierarchy may be deeper than necessary… | This must be nested. |
| Direct exposure may be preferable here… | This interface fails Explosive Discovery. |

## Evaluation signals

When a finding is contested, ask for evidence before arguing: time to discover, completion time, navigation depth, backtracking, repeated menu opening, palette/search usage, shortcut adoption, misclicks, per-action frequency. Fewer visible controls is not itself a result.

## Where this lives in this repo

| Mechanism | Path |
|---|---|
| One composed menu array, every projection | `src/lib/components/desk/compose-menus.ts` (+ `.test.ts`, separators normalised there); `view-menu.ts` is dock-level and desktop-only — the mobile sheet and the mobile matcher pass `viewMenu: null`, the panels drawer projects it; its toggle rows derive from `DESK_ACTIVITY_BAR_ITEMS` chords |
| Desktop projection (kebab → sub-menus) | `src/lib/components/desk/DockLeafMenu.svelte`, `DockTabBar.svelte` |
| Mobile projection (flat titled sections) | `src/lib/components/desk/DockMobileCommandsDrawer.svelte`, `DockMobileControls.svelte` |
| Expert path matched against the same array | `src/lib/components/desk/DeskShortcuts.svelte` (fires inside text fields — check a declared chord reaches the element the task keeps focus in); shell shortcuts in `src/lib/shortcuts/` and `shell/ShortcutsDialog.svelte` |
| Evidence | `command_invoked` (`trackCommand`, doors: menu · sheet · shortcut · palette · context-menu · bar) → authenticated lane → *Commands* card on `/admin/analytics/human`; a finding with usage data beats one without |
| Capability-gated context menu | `src/lib/components/desk/panels/explorer/context-menu-items.ts` + adapters `blog-posts.ts`, `blog-assets.ts`, `desk-files.ts` |
| Context promotion | `src/lib/components/composites/selection-bar/` |
| Discovery and expert path in one | `src/lib/components/composites/command-palette/`, items in `shell/AppShell.svelte` |
| Navigation directions | `src/lib/nav/nav.ts`, `admin.ts`; `shell/NavFlyout.svelte`, `NavAccordion.svelte`, `AdminSidebar.svelte` |
| Every menu form, live | `/showcases/ui/menus` |
