---
name: Hover Background Token Analysis
description: Analysis of the hover:bg-border anti-pattern and recommendation to introduce --color-hover-bg as a dedicated token
type: project
---

# Hover Background Token: From `border` to `hover-bg`

## The Problem

`hover:bg-border` is used across 20+ components (NavItem, NavAccordion, SidebarTriggers,
SidebarLogo, UserMenu, ShortcutsModal, DiceRollButton, ToastContainer, button.ts, etc.).

The `--color-border` token carries dual semantic load: visible line separators AND hover
backgrounds. These two uses require conflicting lightness values:
- Border lines need enough opacity/contrast to be visible as strokes
- Hover backgrounds need to be barely-there tints that don't obscure text

When accessibility requirements push `border` darker (P0, `prefers-contrast: more`), text
contrast on hover collapses. P0 light: `border: oklch(0.75 0 0)`, `prefers-contrast: more`
pushes it to `oklch(0.65 0 0)` — dangerously close to killing fg contrast on hover.

**Why:** This is a recognized anti-pattern. shadcn/ui introduced it when `border` happened
to be a mid-tone neutral that doubled as a soft hover tint. The flaw is structural at scale.

## What Design Systems Use Instead

- **Radix Themes**: Dedicated color scale steps (step 3 = hover bg, step 6-7 = border). Never shared.
- **shadcn/ui current**: `bg-accent` for hover, explicitly decoupled from `border`.
- **Material Design 3**: 8% opacity overlay of `on-surface` — derived from text color, always readable.
- **Tailwind UI**: `hover:bg-{color}-50` tints at lighter steps than borders.

Principle: hover backgrounds are always lighter/more transparent than border colors in the same scale.

## Recommendation: `--color-hover-bg` dedicated token

DO NOT repurpose `subtle` — it already carries "inert background surface" semantics and
reusing it for hover creates the same dual-role problem.

A dedicated `--color-hover-bg` token:
- Sits between `subtle` and `border` in lightness (closer to `subtle`)
- Allows P0 to set strong hover feedback independently of its strong border
- Carries single responsibility: "hover state tint for interactive elements"
- Validates independently for text contrast

## Migration Plan

1. Add `hover-bg` key to `PaletteColors` type in `types.ts`
2. Add `--color-hover-bg` values to all 9 palette blocks in `app.css` (`:root`, `.dark`, P0–P7 and their dark variants)
3. Add `hover-bg` to the color config in `tokens.ts` so UnoCSS generates `bg-hover-bg`
4. Global find-and-replace: `hover:bg-border` → `hover:bg-hover-bg` (all 20+ components in one pass)

**How to apply:** When implementing, suggested values:
- Light mode default: ~`oklch(0.88 0 0)` range — slightly below `subtle` for visibility
- Dark mode default: ~`oklch(0.22 0 0)` range — slightly above `subtle`
- P0 light: `oklch(0.88 0 0)` (clearly visible on near-white without overdoing it)
- P0 dark: `oklch(0.22 0 0)`
- Chromatic palettes: match the palette hue at the same L as the light/dark defaults

## Separate Concern: `secondary` button variant

`button.ts` uses `bg-border` as the background fill for the secondary button (not just hover).
This is semantically odd and will break under P0's dark border. Needs its own fix — likely
`bg-subtle` or a new `--color-surface-interactive` token. Track separately.
