# Explosive Discovery

An interface shows what the user's current intent needs and keeps the rest one meaningful step away. Capability explodes outward on demand: nothing is hidden, everything is nested by meaning, and a more specific intent reveals a more specific set of choices.

> **Simple at every level, powerful across levels.**

---

## Three names, three jobs

| Name | Job | Where |
|---|---|---|
| **Progressive disclosure** | The intent — *show what is needed now, reveal complexity on demand* | Design principle 3 in [blueprint/design/README.md](../blueprint/design/README.md#3-progressive-disclosure) |
| **Explosive Discovery** | The principle — how a product organizes capability so that disclosure works on a page, in a menu and across a user's journey; what it must never do; what an adopter emulates | This page; its review method is [blueprint/design/explosive-discovery.md](../blueprint/design/explosive-discovery.md), and the procedure agents follow is the skill `uxy-explosive-discovery` |
| **Nested Depth** | The structure the principle recommends — directions that narrow intent, detail on entry | Defined in the review method |

## Core philosophy

| Principle | Description |
|---|---|
| **User-paced** | Depth opens on an explicit action — a click, a selection, a completed step — never on time elapsed or distance scrolled |
| **Depth without hiding** | The user always feels *there is more here if I need it*, never *I don't know whether this application can do it*: categories, continuation indicators, search, a *More* that is a direction rather than a bucket |
| **Context promotes, temporarily** | State the page already has — a selection, a dirty document, a sibling panel — lifts a deep action to the surface; when the state ends, the action returns to its depth |
| **An expert path beside every discovery path** | A shortcut, a palette entry, a direct action, a remembered choice — declared *with* the discovery path, never in a second table that can drift |
| **Persistent position** | Resume where you left off — a page, a stage, a workspace — even without an account |
| **Optional depth** | Every guided step can be skipped, and the skip is always visible; a completed stage stays visible, muted, never removed |

**Anti-goals**

- Forced tutorials that block content
- Navigation hidden "until it is useful" — it disorients
- Gates that make an experienced user traverse the introduction again
- Scroll-jacking, time-based triggers, unskippable animation
- Nesting whose only justification is *there was not enough room* — a submenu of leftovers
- A mobile projection that merely compresses the desktop one

## Two axes

The principle applies on two orthogonal axes. One is built and reviewable today; the other
is a direction.

### Depth axis — one page, one moment

A page or menu that offers more than roughly **5 ± 2** unrelated choices at once is a reason
to look (never a limit). Semantic compression turns implementation-level actions into
user-level directions, and entering a direction reveals the next level of detail:

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

**Built.** The desk's panel menus embody it: `composePanelMenus()`
(`src/lib/components/desk/compose-menus.ts`) produces one array; the desktop kebab renders it
as one sub-menu per direction, the mobile commands sheet renders the same array as flat titled
sections, and `DeskShortcuts.svelte` matches keyboard chords against the same array the menu
renders. The menu forms a direction can take are on
[/showcases/ui/menus](/showcases/ui/menus). How to review a surface against this axis —
the choice trigger, context first, projections, review signals, the advisory five-part output —
is the [review method](../blueprint/design/explosive-discovery.md).

### Journey axis — one user, over time

The same principle stretched across a visit and a relationship: content and features reveal as
the user's *demonstrated* intent grows, so a newcomer is not overwhelmed and a returning user is
not re-introduced.

**A direction, not a feature.** Nothing in `src/` gates content by journey stage; there is no
guest identity, no progress record, no achievement. What follows is the design an adopter
emulates, kept here because it is the same principle as the depth axis and would otherwise be
reinvented under a second name.

| Revelation | Opens on | Reveals |
|---|---|---|
| **First visit** | Page load | The hero, one primary action, the preferences that matter now — for example the style [dice roll](./style.md#first-time-user-experience-ftux) |
| **Exploration** | The first meaningful action | Content sections, value propositions |
| **Commitment** | Content completed | The invitation to sign up — "ready for next steps" |
| **Sign-up** | An explicit choice | Passwordless, one field, a privacy promise in view; *Log in* prominent, *Create account* secondary |
| **Onboarding** | Offered, never imposed | *Explore freely* and *Take the tour* side by side; every step skippable, feedback brief and inline, never a blocking modal |

What counts as a meaningful action: clicking a primary action, completing a section, changing
a preference, bookmarking. What never counts: a page view, a scroll position, time on page.

| Rule | Why |
|---|---|
| **Adapted content, not locked routes** | The same route shows what is possible at every stage; a shared link never hits a wall. Only truly private routes — settings, personal data — require an account |
| **Visual history** | A completed stage is muted and checked, not removed; the navigation affordance is visible from the first visit and expands as sections open |
| **Progress is ambient** | A subtle indicator the user consults when they want — dots, a fraction, a badge — never a bar that demands attention or regresses |
| **Guest continuity** | A returning visitor is recognized and resumes without an account; on sign-up the guest's progress merges into the account — the higher stage wins, sets union — and stale guests are cleaned up |
| **Every choice is a valid path** | Completing the tour and skipping it are celebrated equally — one for thoroughness, one for independence. Nothing is framed as *skipped*; there are no "complete your profile" nags |

## Invariants (what to emulate)

The pattern is the principle, not a component library or a navigation structure. A project
adopting it keeps these:

1. **Availability is not visibility.** The capability model stays explicit and complete — what
   *can* be done; the page decides what to *show now*. Hiding never removes a capability from
   the model, and an agent reading the model sees all of it.
2. **Every projection renders the same capability set.** Desktop, mobile, keyboard: only the
   arrangement differs. A command present on one and absent on another is a bug.
3. **Every discovery path has an expert path**, declared beside it — never in a second table
   that can drift.
4. **Context promotion is temporary.** An action surfaced by state returns to its depth when
   the state ends.
5. **~5 ± 2 is a trigger, never a limit.** A flat list stays flat when it is familiar,
   scannable, repeated, or a comparison.
6. **Depth opens on explicit action.** Never on time, never on scroll.
7. **Adapted content, never locked routes.** A stage changes what a page shows, not whether it
   answers.
8. **Skip is always visible.** Guided depth is an offer; declining it is a valid path.

## Accessibility

| Concern | Requirement |
|---|---|
| Screen readers | Announce newly revealed content |
| Keyboard | Every level and every stage reachable without a pointer; the expert path is a keyboard path |
| Focus | Focus moves to what was just revealed |
| Motion | Respect the user's motion preference; every animation skippable |
| Color | State (completed / current / upcoming) never carried by color alone |

## Related

- [blueprint/design/explosive-discovery.md](../blueprint/design/explosive-discovery.md) — the review method: choice trigger, context first, projections, review signals, output shape
- [blueprint/design/README.md](../blueprint/design/README.md#3-progressive-disclosure) — design principle 3, the intent this principle serves
- [style.md](./style.md) — Style Randomization; its dice roll is the first revelation
- [user-data.md](./user-data.md) — the data classification a guest-to-account merge would live under
- [architecture.md](./architecture.md) — state layers and routing patterns
- `.claude/skills/uxy-explosive-discovery/SKILL.md` — the review procedure agents follow
