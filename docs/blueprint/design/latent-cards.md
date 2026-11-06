# Latent Cards

A card whose actions rest neutral and take their colour when the user shows intent: hover,
keyboard focus, or a tap on the card's surface. The card can carry depth (a scroll area, an
accordion, a carousel) that opens only on a deliberate act.

> **Latent Cards are [Explosive Discovery](../../foundation/explosive-discovery.md) at the
> scale of one card.** Capability stays complete; only the emphasis follows intent. Design
> principle 3, [Progressive Disclosure](./README.md#3-progressive-disclosure), is the intent
> this serves.

Component: `LatentCard` (`src/lib/components/composites/latent-card/`). Live:
`/showcases/ui/cards`.

## Three levels

```text
Level 0   the card          media · eyebrow · title · summary       always shown
Level 1   latent actions    neutral at rest, coloured when engaged  always present, always operable
Level 2   depth             scroll area · accordion · carousel      opened by a deliberate act
```

A grid of resting cards reads as content, not as a wall of buttons. The user who reaches for
one card sees that card's actions light up, and only that card's.

## Rules

1. **Rest is neutral, not disabled.** A resting action uses the muted text token, no fill and
   no accent. It is never dimmed with opacity and never styled like `disabled`: it meets text
   contrast (4.5:1) and works on the first click. A grey that looks disabled lies about what
   the user can do.
2. **Engagement changes emphasis, never capability.** Hover, focus and a touch tap all lead to
   the same engaged look. No action exists only on hover, and no action is removed at rest, so
   screen readers and the tab order see the same card in both looks.
3. **Nothing moves.** Actions hold their place in both looks. A grid of cards never reflows
   when one engages, and the pointer never chases a target that slid in under it.
4. **Hover hints, a deliberate act opens.** Level 2 opens by click, scroll, swipe or keyboard.
   Engagement may tint the depth divider as a hint. Content that opens on hover fires by
   accident when the pointer crosses a grid, and does not exist on touch.
5. **Hover only where hover exists.** Hover styles sit under `@media (hover: hover)`. On touch,
   a tap on the card's surface (not on a control) pins it engaged; a tap elsewhere or Escape
   releases it. A tap on an action simply runs the action, pinned or not.
6. **Keyboard is first-class.** `:focus-within` engages the card the moment focus enters it,
   before hydration and with no script.

## How it is built

The engaged look is pure CSS, so it costs nothing at rest and works before hydration:

| Signal | Mechanism |
|---|---|
| Mouse hover | `.latent-card:hover` inside `@media (hover: hover)` |
| Keyboard focus | `.latent-card:focus-within` |
| Touch / pen tap on the surface | `data-pinned`, the component's only state |

The touch pin's rule is a pure function (`nextPinned`, `isSurfaceTap` in `latent-card.ts`): a
surface tap toggles, an outside tap or Escape releases, a mouse never pins (it already
hovers), a tap on a control belongs to the control. Unit-tested in `latent-card.test.ts`.

Actions are `Button` (ghost) controls with a `tone`: `neutral`, `primary` (the card's main
way forward) or `danger`. The tone shows only when engaged; at rest every action is the same
neutral grey. Placement is a `footer` bar with labels, or a `corner` cluster of icon-only
actions whose label becomes the accessible name and tooltip.

The action group is a `role="group"` named "Actions for {title}" (i18n key
`composites_latent_card_actions_aria`), and the article is labelled by its title.

## Depth

The `depth` snippet takes any primitive the user operates on purpose:

| Depth | Primitive | Give it |
|---|---|---|
| A long list (release notes, history) | `ScrollArea` | A fixed height, so the card keeps its footprint |
| Grouped detail (specs, FAQs) | `Accordion` | Closed by default; one item open at a time |
| Alternative views (photos, variants) | `Carousel` | No autoplay inside a card; arrows and dots for control |

Keep each depth's resting footprint fixed. An accordion grows when the user opens it, which
is the deliberate act; nothing grows because the pointer passed by.

## When not to use it

- **One or two actions that dominate.** Show them at full strength; latency only hides the
  obvious.
- **Actions users repeat all day** (a triage queue, an expert console). The resting grey
  costs a beat every time; full-strength actions are faster.
- **A single card on a page.** With nothing to compare it against, the card is the focus and
  its actions should be too.
- **More than about four actions.** Group them first (an overflow menu as the last action),
  then let the group rest. Latency is not a substitute for structure; see
  [explosive-discovery.md](./explosive-discovery.md).

## Related

- [explosive-discovery.md](./explosive-discovery.md): the review method this applies at card scale
- [components.md](./components.md): component layers and the catalog rule
- `/showcases/ui/menus`: overflow and contextual menus, for when actions outgrow a card
