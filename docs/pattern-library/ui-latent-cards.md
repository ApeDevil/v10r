---
title: "Latent Cards — actions that rest neutral and wake on intent"
description: "A card whose actions sit in their final place, neutral but enabled, and take their colour when the user engages the card: hover (only under hover: hover)…"
category: "UI Components & Design System"
---

# Latent Cards — actions that rest neutral and wake on intent

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** UI Components & Design System · **Tier:** deep · **Maturity:** proven (verified 2026-11-06) · **Risk:** low — frontend only

A card whose actions sit in their final place, neutral but enabled, and take their colour when the user engages the card: hover (only under hover: hover), keyboard focus via :focus-within, on touch screens the card nearest the screen's center as the user scrolls, or a touch tap on the card's surface that pins it until an outside tap or Escape. Three disclosure levels: the card (always), latent actions (always operable, emphasised on engagement), and depth (a scroll area, accordion or carousel) opened only by a deliberate act. Explosive Discovery at the scale of one card.

**When to use:** A grid or list of comparable cards that each offer the same few actions, where showing every card's actions at full strength would turn the content into a wall of buttons.

## Avoid when

- One or two actions dominate the card — show them at full strength
- Actions users repeat all day (triage queues, expert consoles), where the resting grey costs a beat every time
- A single card that is already the page's focus
- More than about four actions — group them into an overflow menu first; latency is not a substitute for structure

## Alternatives

- **A plain Card with full-strength actions** — prefer when the actions are few, repeated constantly, or the card stands alone
- **An overflow menu (kebab) per card** — prefer when the actions are many or rarely used and need no visual presence at all

## Docs

- [docs/blueprint/design/latent-cards.md](/docs/blueprint/design/latent-cards) — The three levels, the six rules, how the engaged look is built, depth primitives, when not to use it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/latent-cards.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/latent-cards.md))
- [docs/blueprint/design/explosive-discovery.md](/docs/blueprint/design/explosive-discovery) — The review method this applies at card scale ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/explosive-discovery.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/explosive-discovery.md))

## Code

- `src/lib/components/composites/latent-card/LatentCard.svelte` — The card: CSS engagement (hover under hover: hover, :focus-within), the touch pin as data-pinned, footer or corner actions, the depth slot ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/latent-card/LatentCard.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/latent-card/LatentCard.svelte))
- `src/lib/components/composites/latent-card/latent-card.ts` — Action and tone types; the touch-pin rule (nextPinned, isSurfaceTap) and the center rule (pickCenteredCard) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/latent-card/latent-card.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/latent-card/latent-card.ts))
- `src/lib/components/composites/latent-card/center-engagement.ts` — One page-wide tracker: passive scroll and resize, one measure per frame, only under (hover: none) and (pointer: coarse) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/latent-card/center-engagement.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/latent-card/center-engagement.ts))

## Tests

- `src/lib/components/composites/latent-card/latent-card.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/latent-card/latent-card.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/latent-card/latent-card.test.ts))

## Proof

- [`/showcases/ui/cards`](/showcases/ui/cards)

## Invariants

- A resting action is enabled and meets text contrast: muted token, no fill, no accent — never opacity or a disabled look
- Engagement changes emphasis, never capability: no action exists only on hover, none is removed at rest
- Actions hold their place in both looks; engaging a card never reflows the grid
- Hover never opens level-2 depth; only a click, scroll, swipe or key does
- Hover styles live under @media (hover: hover); keyboard engagement is :focus-within and needs no script
- On touch, at most one card is centered at a time, and only a card whose own center is on screen

## Emulation notes

- Keep the engaged look in CSS; the only state is the touch pin, so the card works before hydration
- Give depth a fixed resting footprint (a ScrollArea height, a closed Accordion, a Carousel without autoplay)
- Name the action group from the card title so a screen reader hears which card the actions belong to

## Depends on

- [Explosive Discovery — nested depth for dense menus and pages](/docs/pattern-library/ui-explosive-discovery)
- [Primitives (~40 Bits UI wrappers)](/docs/pattern-library/ui-primitives)

---

_Machine-readable record: `ui-latent-cards` in `pattern-library/registry.json`._
