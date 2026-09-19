# Explosive Discovery — Nested Depth

A review heuristic for a menu, toolbar or page that has grown past a handful of unrelated
actions. Its motto:

> **Nested Depth — simple at every level, powerful across levels.**

It is a way of reasoning, not a compliance framework. Nothing here fails a gate, requires a
restructuring, or turns a number into a design-system constraint. A finding is mandatory only
when some *other* requirement — accessibility, a product rule — makes it so.

> **Not Progressive Revelation.** [ProgRev](../../foundation/progressive-revelation.md)
> (planned) gates *content* by journey stage over time. Explosive Discovery structures
> *choices* on one page at one moment. Both refine design principle 3,
> [Progressive Disclosure](./README.md#3-progressive-disclosure) — this document is its
> review method.

The shape it looks for:

```text
Overview        what is here
    ↓
Direction       which way am I going
    ↓
Context         what am I working with
    ↓
Action          what do I do to it
    ↓
Detail          how exactly
```

Live embodiment: the `/desk` panel kebab and the mobile commands sheet render one composed
menu array in two projections · the menu forms a direction can take: `/showcases/ui/menus`.

## The objective

Review an interface as a relationship:

**Capability × Simultaneous Complexity × Context**

The desired outcome is *maximum capability with minimum necessary simultaneous choice*. A
powerful application may contain hundreds of actions; the user should not have to understand
hundreds of actions at the same time. Complexity becomes available progressively as intent
becomes specific.

## From a flat list to directions

Do not assume every available action deserves equal visibility. A flat toolbar might expose:

```text
Edit · Rename · Duplicate · Move · Parent · Date · Duration · Map · Coordinates · Link · Share · Export · Delete
```

A Nested Depth reading of the same capability begins with:

```text
Edit · Structure · Place · Connect · Share · More
```

Entering **Place** reveals `When · Where · Map`; entering **When** reveals the temporal
operations. The capability has not disappeared. Its presentation has acquired structure.

**Semantic compression** is the move that makes this possible: several implementation-level
actions that belong to one semantic direction become one user-level decision.

| Implementation-level actions | One user-level decision |
|---|---|
| Start Date · End Date · Duration · Timeline | Time |
| Coordinates · Region · Place · Map | Location |
| Rename · Move to… · Duplicate | Structure |

**Meaningful nesting** follows meaning, and each transition narrows intent:
`Settings → Notifications → Email → Frequency`, or `Create → Content → Article → Template`.
Nesting whose only justification is *there was not enough room* is not Nested Depth; a
submenu of unrelated leftovers is the anti-pattern this heuristic exists to catch.

## The choice trigger

Inspect a menu or page that exposes roughly more than **5 ± 2** meaningful primary choices at
once. The number is deliberately approximate: it is a reason to look, never
`maximumChoices = 7`. Review the cognitive structure, not the button count.

| More choices can be right when… | Fewer choices may be better when… |
|---|---|
| they are highly familiar | the decision needs significant interpretation |
| they are visually easy to scan | the user is new to the workflow |
| comparison between them is the point | one or two actions dominate the context |
| the interface is intentionally exploratory | choosing wrongly has substantial consequences |
| users need direct, repeated access | |
| nesting would make the workflow slower | |

## Context first

Before judging the visible actions, establish the user's position:

1. What object or resource is active, and in what state?
2. What task is likely underway, and which actions naturally continue it?
3. Which actions are technically possible but weakly related?
4. Which actions become relevant only after another decision?

Visibility is judged relative to that context. An action can be important globally and
irrelevant locally. As a reasoning aid — never a computed score —

**Priority = Relevance × Frequency × Context × Continuity**

where *relevance* is closeness to what the user holds, *frequency* how often the action is
expected, *context* fitness to object, state, permissions and environment, and *continuity*
how naturally it continues the work already underway.

Context may also **promote** a deep action. `Connect → Relationship → Create Relationship` is
a fine normal discovery path; when the user has selected two compatible objects, *Create
Relationship* deserves immediate visibility.

> Depth defines normal discovery. Context determines temporary prominence.

The desk does this in three places: the editor's *Save* exists only while the document is
dirty (`src/lib/components/desk/panels/editor/EditorPanel.svelte`); *Switch to <sibling>* and
*Close Other Instances* appear only when a panel has siblings
(`src/lib/components/desk/compose-menus.ts`); a
[selection bar](/showcases/ui/menus) renders only while a selection exists
(`src/lib/components/composites/selection-bar/`). Each returns to its depth when the state
ends.

## Depth without hiding

Progressive disclosure is not hiding. The user should feel *there is more here if I need it*,
never *I don't know whether this application can do it*. Signals that keep depth discoverable:
semantic categories, expandable controls, contextual menus, nested panels, command interfaces,
search, visible continuation indicators, breadcrumbs, contextual suggestions, a *More*
mechanism that is a direction rather than a bucket.

Depth must not punish expertise either. Repeated workflows earn a second route:

| Discovery path | Expert path |
|---|---|
| `Create → Content → Article` | *New Article* as a direct action |
| kebab → View → Split Right | `Ctrl+Shift+E` |
| sidebar → Showcases → UI → Menus | `⌘K` "menus" |
| menu traversal | recent actions, remembered choices, contextual quick actions |

A deeper conceptual hierarchy never requires the experienced user to traverse it every time.
The desk keeps both routes in one truth: a shortcut is declared *on the menu item*, and
`DeskShortcuts.svelte` matches keyboard events against the same composed array the kebab
renders — there is no second table that can drift.

## One hierarchy, many projections

Review the conceptual structure independently of its visual projection. The same semantic
hierarchy may appear as several directions side by side on a desktop and as vertical
navigation, progressive panels, expandable sections, sheets or sequential steps on a phone.
Identical layouts are not required; conceptual consistency is required only where it helps
comprehension.

The desk's contract is the reference: `composePanelMenus()` produces one array; the desktop
kebab (`DockLeafMenu.svelte`) renders it as one sub-menu per direction, the mobile commands
sheet (`DockMobileCommandsDrawer.svelte`) renders the same array as flat titled sections
because hover sub-menus are hostile to touch. The dock-level View menu is the one projection
rule: the sheet passes none — and so does the keyboard matcher on that projection — because
on touch the panels drawer already projects every View command (a row per panel type that
shows or opens, a Preferences row) and the structural toggle/split verbs must never reach a
touch surface, not from a hardware keyboard either. A *capability* present on one projection
and absent on the other is a bug, not an adaptation; the *place* it is projected may differ.
The rule has a third reading: a hand-built menu beside the composed array (a tab's
right-click, a header icon) is a projection too — it prints the chord of the row it mirrors
and mints nothing of its own.

Where the application already knows its capabilities — permissions, domain operations, tool
definitions — the interface can *derive* its actions from them. But **availability is not
visibility**. The system may know twelve operations are valid while the page surfaces three
directions. Keep the two questions apart:

| What can be done? | What should be shown now? |
|---|---|
| the capability model — explicit, complete, inspectable | the projection — contextual, prioritized, nested |

The distinction matters most for agent-accessible applications. An agent may inspect the
whole capability surface through an API, MCP tool or command system; the human interface may
nest the same capabilities. Neither implies the other: an operation available to an agent
does not deserve equal visual prominence, and a nested human UI is no reason to remove the
structured capability definitions the agent reads.

## Review signals

Reasons to investigate — not automatic defects.

| Signal | What it usually means | Where to look |
|---|---|---|
| Many unrelated actions compete at once | no directions yet | the flat list — group by meaning |
| Common and rare actions share prominence | frequency ignored | usage, or the obvious dominant task |
| Implementation concepts leak into user decisions | hierarchy follows architecture | labels that name tables or modules |
| A long flat menu keeps accumulating | each feature added one row | the menu's growth history |
| Several actions are variations of one decision | compression missing | verbs with shared objects |
| An important capability is hard to discover | depth without signal | is there any continuation indicator? |
| Users repeatedly traverse the same nesting | depth deeper than the decision | expert path missing |
| *More* is a miscellaneous dumping ground | nesting by leftover, not meaning | what the bucket's items share (nothing) |
| Mobile merely compresses desktop | projection, not hierarchy, was ported | hover sub-menus on touch; dropped commands |
| Context is known but does not affect prominence | promotion missing | state the page already has (selection, dirty, siblings) |
| Disclosure adds interaction to a common workflow | depth on the wrong action | the happy path's click count |

## When flat is right

Do not recommend nesting because this pattern exists. Nested Depth makes an interface worse
when it is applied where scanning beats navigating. Flat presentation is often preferable for
small action sets, highly familiar tools, comparison interfaces, dashboards, expert consoles,
repetitive workflows, and anywhere the user reads faster than they navigate. A review always
asks the counter-question — *would exposing the actions directly be clearer?* — and explains
the trade-off either way.

## Review output and language

Report each finding in five parts. The procedure that produces them lives in the skill
`.claude/skills/uxy-explosive-discovery/SKILL.md`.

| Part | Carries |
|---|---|
| **Observation** | the current interface and the simultaneous choices it presents |
| **Reasoning** | context, semantic relationships, workflow frequency, discoverability, interaction cost |
| **Opportunity** | where grouping, prioritization, disclosure, contextual promotion — or flattening — could help |
| **Possible Direction** | a concrete example of how the interaction could be organized |
| **Trade-off** | what the direction makes better and what it makes worse |

The language is advisory because the heuristic is.

| Say | Never say |
|---|---|
| Consider… · This may benefit from… · Review whether… | This violates Nested Depth. |
| A possible semantic grouping is… | There are too many actions. |
| This action may deserve contextual promotion… | A maximum of seven choices is allowed. |
| This hierarchy may be deeper than necessary… | This must be nested. |
| Direct exposure may be preferable here… | This interface fails Explosive Discovery. |

## Evaluation

Validate a recommendation with evidence where practical; fewer visible controls do not
automatically produce better UX. A successful change improves comprehension without
materially damaging task efficiency.

| Signal | Reads as |
|---|---|
| time to discover an action · task completion time | comprehension and cost together |
| navigation depth · backtracking · repeated menu opening | a hierarchy deeper than the decision |
| command / search usage · shortcut adoption | whether an expert path exists and is found |
| abandoned interactions · misclicks | choice load or mis-grouping |
| frequency of individual actions · user testing | what deserves prominence at all |

## Invariants (what to emulate)

The pattern is the principle, not a component library, a navigation structure or a menu
system. A project adopting it keeps these:

1. **Availability is not visibility.** The capability model stays explicit — what can be done
   — and the page decides what to show now. Hiding never removes a capability from the model.
2. **Every projection renders the same composed capability set.** Desktop, mobile, keyboard:
   only the arrangement differs. A command present on one and absent on another is a bug.
3. **Every discovery path has an expert path**, declared beside the menu item — a shortcut,
   a palette entry, a recent — never in a second table that can drift.
4. **Context promotion is temporary.** An action surfaced by state (selection, dirty,
   siblings) returns to its depth when the state ends.
5. **~5 ± 2 is a trigger, never a limit.** A flat list stays flat when it is familiar,
   scannable, repeated, or a comparison.

An adopter should be able to say, for their own product: the problem it addresses, when it is
useful, when it should not be used, its trade-offs, how it projects across devices, how
context changes prominence, how experts bypass depth, and how its effect is measured.

## Guiding questions

For every reviewed interface, in this order:

1. Does the user need to understand all of these choices right now?
2. Can several actions be represented as meaningful directions?
3. Does entering a direction naturally reveal the next level of detail?
4. Can experienced users still reach common actions efficiently?

The desired result is not minimalism for its own sake.

> Bound the breadth when useful. Expand the depth when meaningful. Let context bring the
> right capabilities to the surface.

## Related

- [README.md](./README.md#3-progressive-disclosure) — design principle 3, which this document refines into a review method
- [components.md](./components.md) — the component layer system the menu composites belong to
- [app-shell/navigation.md](../app-shell/navigation.md) — the split nav button: one direction per top-level item, subpages on entry
- [app-shell/keyboard-shortcuts.md](../app-shell/keyboard-shortcuts.md) — the shell's expert paths
- [quick-search/architecture.md](../quick-search/architecture.md) — the command palette as a discovery *and* expert path
- [foundation/progressive-revelation.md](../../foundation/progressive-revelation.md) — the planned journey-stage feature this is *not*
- `.claude/skills/uxy-explosive-discovery/SKILL.md` — the review procedure agents follow
