---
name: Style Randomizer UX Plan
description: Finalized UX spec for Style Randomizer v1 including shape axis, naming, locking, button radius, and mobile layout decisions
type: project
---

## Context

Style Randomizer randomizes typography + palette per visit. DiceRollButton triggers POST /api/style/roll → sets httpOnly cookie → CSS var update (no invalidateAll needed per SVEY) → Svelte reactivity propagates. The palette swap itself is instant (data-attribute DOM mutation). Shape (radius) is the third axis added in this overhaul.

**Key insight from scout**: DaisyUI `[data-theme]` attribute switching makes palette change a single DOM attribute mutation — no flash, no transition needed. Style change is not a visual animation event; it's a data reload.

## Why

Original plan was drafted without cross-domain input. This final spec incorporates ARCHY (shape axis + cookie), RESY (named palettes), SCOUT (Coolors lock pattern, named presets), SVEY (no invalidateAll, instant CSS var update), and SVEY's instant-is-correct finding for the swap.

## Finalized Decisions

### Naming after roll
- **Hero label**: Palette name only. E.g. "Terracotta". No dots, no typography name, no shape name.
  - Style: `text-fluid-sm`, `color-muted`, 12px gap above button
  - Appears after the first roll (not on page load)
- **Sidebar toast**: Palette · Typography (unchanged). Shape not added to toast — shape is felt, not read.
- Rationale: palette name carries emotional punch; multi-axis label reads as a data readout, not a discovery moment.

### Shape axis swap
- Instant swap is correct with all 3 axes changing simultaneously — color dominates visual attention, radius and typography are background texture.
- Shape must be applied in the same `$effect` tick as palette and typography (atomic, no sequencing gap).
- Extend the existing effect in `style.svelte.ts`:
  ```ts
  $effect(() => {
      if (!browser) return;
      document.documentElement.dataset.palette = current.paletteId;
      document.documentElement.dataset.typography = current.typographyId;
      document.documentElement.dataset.radius = current.radiusId; // added
  });
  ```

### Per-axis locking
- **V1: No per-axis locking.** Single all-or-nothing lock only.
- Coolors pattern is a V2 concern — requires users to have built intent around individual axis values, which requires prior familiarity.
- Revisit when analytics show users rolling >6 times per session (hunting a specific axis).

### Button radius (shape axis inheritance)
- **Expanded DiceRollButton**: replace `rounded-md` with `rounded-theme` (reads `var(--radius-base)`)
  - UnoCSS shortcut: `'rounded-theme': 'rounded-[var(--radius-base)]'`
- **Rail (collapsed) DiceRollButton**: stays `rounded-full` always (circular icon button)
- **Homepage hero roll button**: also `rounded-theme` — the button the user clicks IS the demonstration of what changed
- Philosophy: the ghost button should feel alive because it IS the canvas.

### Mobile hero layout
- No elements cut. Stack order on mobile:
  1. Classification label
  2. "VELOCIRAPTOR" heading
  3. Tagline
  4. Roll CTA button (new, action before explanation)
  5. Style name label (appears after first roll)
  6. Etymology card
- Roll CTA spec: `h-11 max-w-[200px] self-start` (44px tap target, left-aligned to match text hierarchy, not centered)
- AsciiRaptor already hides on mobile (right column of desktop grid only)

### Homepage vs sidebar behavior
- Homepage: no toast on roll (confirmed from prior plan). Style name label serves as the feedback.
- Sidebar: toast fires as before (`palette · typography` format).

## How to apply

Use this plan when building or reviewing DiceRollButton, StyleContext, the homepage hero CTA, consent banner interaction, or the palette validation pipeline.
