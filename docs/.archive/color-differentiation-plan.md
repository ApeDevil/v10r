# Color Differentiation Implementation Plan

Precise, ordered plan to make palette identity perceptible across structural tokens and components.

---

## Current State Summary

**Architecture**: `palette-registry.ts` is source of truth for OKLCH values. `app.css` has matching `[data-palette="PX"]` CSS blocks that override `:root`/`.dark` defaults. The `style.svelte.ts` sets `data-palette` attribute on `<html>`, activating the correct CSS block.

**Dual-write rule**: Every palette value change must be made in BOTH `palette-registry.ts` AND `app.css`. They must stay in sync.

**Problem confirmed**: P1/P2/P3 structural tokens (bg, surface-*, border, subtle, muted) have chroma 0.01-0.03 -- below human perception threshold (~0.03-0.04 for large areas). P4-P7 already have adequate chroma (0.04-0.08). P0 is achromatic by design (accessibility palette).

---

## Phase 1: Raise Structural Chroma on P1-P3

**Files**: `src/lib/styles/random/palette-registry.ts` + `src/app.css`
**Dependency**: None -- standalone
**Risk**: WCAG contrast ratios may shift. Must validate after changes.

### Strategy

Raise chroma on large-area tokens to the perception threshold. Preserve hue angles exactly. Keep lightness values unchanged to avoid contrast regression. Only touch P1, P2, P3.

### Exact Changes

#### P1 -- Ocean (hue ~220-225)

| Token | Mode | Current | New | Rationale |
|-------|------|---------|-----|-----------|
| `bg` | light | `oklch(0.95 0.01 220)` | `oklch(0.95 0.03 220)` | 3x chroma, perceptible cool tint |
| `subtle` | light | `oklch(0.93 0.01 220)` | `oklch(0.93 0.03 220)` | Match bg chroma |
| `border` | light | `oklch(0.85 0.02 220)` | `oklch(0.85 0.04 220)` | Borders need slightly higher chroma to read |
| `muted` | light | `oklch(0.50 0.03 220)` | `oklch(0.50 0.05 220)` | Mid-lightness needs less boost |
| `input-bg` | light | `oklch(0.94 0.01 220)` | `oklch(0.94 0.03 220)` | Track bg chroma |
| `surface-0` | light | `oklch(0.95 0.01 220)` | `oklch(0.95 0.03 220)` | Matches bg |
| `surface-1` | light | `oklch(0.96 0.01 220)` | `oklch(0.96 0.025 220)` | Slightly less than bg (lighter = less chroma needed) |
| `surface-2` | light | `oklch(0.97 0.005 220)` | `oklch(0.97 0.02 220)` | Gentle tint at high lightness |
| `bg-alpha` | light | `oklch(0.95 0.01 220 / 0.95)` | `oklch(0.95 0.03 220 / 0.95)` | Track bg |
| `bg` | dark | `oklch(0.16 0.02 225)` | `oklch(0.16 0.035 225)` | Dark backgrounds need more chroma to perceive |
| `subtle` | dark | `oklch(0.20 0.02 225)` | `oklch(0.20 0.035 225)` | Match bg level |
| `border` | dark | `oklch(0.30 0.03 225)` | `oklch(0.30 0.05 225)` | Visible edge tint |
| `muted` | dark | `oklch(0.62 0.03 220)` | `oklch(0.62 0.05 220)` | Perceptible blue-grey |
| `surface-0` | dark | `oklch(0.16 0.02 225)` | `oklch(0.16 0.035 225)` | Matches bg |
| `surface-1` | dark | `oklch(0.14 0.02 225)` | `oklch(0.14 0.03 225)` | Slightly less |
| `surface-2` | dark | `oklch(0.12 0.015 225)` | `oklch(0.12 0.025 225)` | Proportional |
| `bg-alpha` | dark | `oklch(0.16 0.02 225 / 0.95)` | `oklch(0.16 0.035 225 / 0.95)` | Track bg |
| `fg-alpha` | light | `oklch(0.25 0.06 230 / 0.1)` | no change | Already adequate |

#### P2 -- Sunset (hue ~40-60)

| Token | Mode | Current | New |
|-------|------|---------|-----|
| `bg` | light | `oklch(0.96 0.01 60)` | `oklch(0.96 0.03 60)` |
| `subtle` | light | `oklch(0.93 0.02 55)` | `oklch(0.93 0.035 55)` |
| `border` | light | `oklch(0.85 0.03 55)` | `oklch(0.85 0.05 55)` |
| `muted` | light | `oklch(0.50 0.03 50)` | `oklch(0.50 0.05 50)` |
| `input-bg` | light | `oklch(0.95 0.01 55)` | `oklch(0.95 0.03 55)` |
| `surface-0` | light | `oklch(0.96 0.01 60)` | `oklch(0.96 0.03 60)` |
| `surface-1` | light | `oklch(0.97 0.01 55)` | `oklch(0.97 0.025 55)` |
| `surface-2` | light | `oklch(0.98 0.005 55)` | `oklch(0.98 0.02 55)` |
| `bg-alpha` | light | `oklch(0.96 0.01 60 / 0.95)` | `oklch(0.96 0.03 60 / 0.95)` |
| `bg` | dark | `oklch(0.15 0.02 40)` | `oklch(0.15 0.035 40)` |
| `subtle` | dark | `oklch(0.20 0.02 45)` | `oklch(0.20 0.035 45)` |
| `border` | dark | `oklch(0.30 0.03 45)` | `oklch(0.30 0.05 45)` |
| `muted` | dark | `oklch(0.62 0.03 50)` | `oklch(0.62 0.05 50)` |
| `surface-0` | dark | `oklch(0.15 0.02 40)` | `oklch(0.15 0.035 40)` |
| `surface-1` | dark | `oklch(0.13 0.02 40)` | `oklch(0.13 0.03 40)` |
| `surface-2` | dark | `oklch(0.11 0.015 40)` | `oklch(0.11 0.025 40)` |
| `bg-alpha` | dark | `oklch(0.15 0.02 40 / 0.95)` | `oklch(0.15 0.035 40 / 0.95)` |

#### P3 -- Forest (hue ~145-155)

| Token | Mode | Current | New |
|-------|------|---------|-----|
| `bg` | light | `oklch(0.95 0.01 145)` | `oklch(0.95 0.03 145)` |
| `subtle` | light | `oklch(0.92 0.02 145)` | `oklch(0.92 0.035 145)` |
| `border` | light | `oklch(0.84 0.03 145)` | `oklch(0.84 0.05 145)` |
| `muted` | light | `oklch(0.48 0.03 145)` | `oklch(0.48 0.05 145)` |
| `input-bg` | light | `oklch(0.94 0.01 145)` | `oklch(0.94 0.03 145)` |
| `surface-0` | light | `oklch(0.95 0.01 145)` | `oklch(0.95 0.03 145)` |
| `surface-1` | light | `oklch(0.96 0.01 145)` | `oklch(0.96 0.025 145)` |
| `surface-2` | light | `oklch(0.97 0.005 145)` | `oklch(0.97 0.02 145)` |
| `bg-alpha` | light | `oklch(0.95 0.01 145 / 0.95)` | `oklch(0.95 0.03 145 / 0.95)` |
| `bg` | dark | `oklch(0.15 0.02 150)` | `oklch(0.15 0.035 150)` |
| `subtle` | dark | `oklch(0.19 0.02 150)` | `oklch(0.19 0.035 150)` |
| `border` | dark | `oklch(0.28 0.03 150)` | `oklch(0.28 0.05 150)` |
| `muted` | dark | `oklch(0.60 0.03 145)` | `oklch(0.60 0.05 145)` |
| `surface-0` | dark | `oklch(0.15 0.02 150)` | `oklch(0.15 0.035 150)` |
| `surface-1` | dark | `oklch(0.13 0.02 150)` | `oklch(0.13 0.03 150)` |
| `surface-2` | dark | `oklch(0.11 0.015 150)` | `oklch(0.11 0.025 150)` |
| `bg-alpha` | dark | `oklch(0.15 0.02 150 / 0.95)` | `oklch(0.15 0.035 150 / 0.95)` |

### Execution Order

1. Update `palette-registry.ts` -- P1 light, P1 dark, P2 light, P2 dark, P3 light, P3 dark
2. Update `app.css` -- `[data-palette="P1"]`, `.dark[data-palette="P1"]`, same for P2, P3
3. Run build-time WCAG validation (happens automatically at import via `contrast.ts`)
4. Visual inspection: cycle through P1/P2/P3 in both modes, confirm tint is perceivable but not overwhelming

### WCAG Risk Assessment

- **bg/surface tokens**: Lightness unchanged, only chroma increased. Since OKLCH chroma raises saturation without affecting perceived lightness, contrast ratios between fg-on-bg should remain stable. Low risk.
- **border chroma increase**: Borders are decorative, not text. No WCAG text-contrast requirement. No risk.
- **muted chroma increase**: `muted` text on `bg` -- lightness gap unchanged (0.50 vs 0.95 in light, 0.62 vs 0.16 in dark). Minimal risk. Verify after.

**Estimated scope**: ~100 line edits across 2 files. Mechanical find-and-replace.

---

## Phase 2: New Tokens (`--color-link`, `--color-accent`)

**Files**: `src/lib/styles/random/types.ts`, `src/lib/styles/tokens.ts`, `src/app.css`, `src/lib/styles/random/palette-registry.ts`
**Dependency**: None (parallel with Phase 1)

### 2a. Add to PaletteColors interface

File: `src/lib/styles/random/types.ts`

Add two OPTIONAL properties to `PaletteColors`:

```typescript
export interface PaletteColors {
    // ... existing 22 tokens ...
    link?: string;      // Text color for hyperlinks. Defaults to primary.
    accent?: string;    // Interactive surface tint (hover states). Defaults to primary.
}
```

**Why optional**: Avoids forcing every palette to define them immediately. Phase 3 components fall back to `var(--color-link, var(--color-primary))`.

### 2b. Add CSS variables to app.css

In `:root`:
```css
--color-link: var(--color-primary);
--color-accent: var(--color-primary);
```

In `.dark`:
```css
--color-link: var(--color-primary);
--color-accent: var(--color-primary);
```

These default to primary. Per-palette overrides are optional -- palettes where primary works well as link color need no override.

### 2c. Add to UnoCSS color map

File: `src/lib/styles/tokens.ts`

```typescript
export const colors = {
    // ... existing tokens ...
    link: 'var(--color-link)',
    accent: 'var(--color-accent)',
};
```

This enables `text-link`, `bg-accent`, etc. in UnoCSS utilities.

### 2d. Per-palette overrides (only where needed)

In `palette-registry.ts` and `app.css`, add `link`/`accent` only for palettes where primary is not ideal for links. Initially, skip this -- the CSS variable fallback chain handles it. Revisit after visual testing.

**Estimated scope**: ~15 line additions across 4 files.

---

## Phase 3: Component Token Swaps

**Dependency**: Phase 2 must be complete (new tokens must exist)
**Files**: 8 component files

### 3a. LinkCard icon: `text-fg` to `text-primary` (HIGH)

File: `src/lib/components/composites/link-card/LinkCard.svelte`

Line 40, change:
```svelte
<span class="{icon} text-3xl text-fg shrink-0" aria-hidden="true"></span>
```
to:
```svelte
<span class="{icon} text-3xl text-primary shrink-0" aria-hidden="true"></span>
```

**Rationale**: Icons on cards should signal the palette's chromatic identity, not blend with body text.

### 3b. LinkCard dark-mode glow: hardcoded purple to palette-aware (HIGH)

File: `src/lib/components/composites/link-card/LinkCard.svelte`

Lines 98-100 in scoped CSS, change:
```css
:global(.dark) .card-wrapper:hover {
    box-shadow: 0 0 20px rgb(152 101 248 / 0.3), 0 0 8px rgb(152 101 248 / 0.2);
}
```
to:
```css
:global(.dark) .card-wrapper:hover {
    box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent),
                0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
```

**Note**: Same fix needed in `src/lib/components/3d/SceneCard.svelte` line 72 (identical hardcoded purple glow).

### 3c. LinkCard sublinks: `secondary-fg` to `link` (HIGH)

File: `src/lib/components/composites/link-card/LinkCard.svelte`

Line 113 in scoped CSS, change:
```css
color: var(--color-secondary-fg);
```
to:
```css
color: var(--color-link);
```

**Rationale**: `secondary-fg` is near-identical to `fg` in many light-mode palettes. Links need chromatic distinction.

### 3d. EmptyState icon: add palette tint (HIGH)

File: `src/lib/components/composites/empty-state/EmptyState.svelte`

Lines 46-49 in scoped CSS, change:
```css
.empty-icon {
    font-size: var(--text-fluid-4xl);
    margin-bottom: var(--spacing-4);
    opacity: 0.5;
}
```
to:
```css
.empty-icon {
    font-size: var(--text-fluid-4xl);
    margin-bottom: var(--spacing-4);
    color: var(--color-primary);
    opacity: 0.6;
}
```

**Rationale**: Empty states are prominent UI moments. A palette-tinted icon creates identity without being loud.

### 3e. Badge default variant: add `text-primary` in scoped CSS (HIGH)

File: `src/lib/components/primitives/badge/Badge.svelte`

The `default` variant uses class `bg-primary text-primary` (from `pill-variants.ts`). The scoped CSS handles `bg-primary` background via `color-mix`, but there is no corresponding scoped rule for text color. The `text-primary` class should work via UnoCSS, but confirm it generates correctly.

If `text-primary` does not extract (known `.ts` extraction issue), add to Badge.svelte scoped CSS:
```css
span:global(.text-primary) {
    color: var(--color-primary);
}
```

**Check first**: Inspect rendered Badge default variant. If text is already primary-colored, skip this.

### 3f. Checkbox checked: `text-white` to `text-on-primary` (HIGH)

File: `src/lib/components/primitives/checkbox/Checkbox.svelte`

Line 33, change:
```
'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-white'
```
to:
```
'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-on-primary'
```

**WCAG risk**: `on-primary` must have sufficient contrast against `primary`. Verify for all 8 palettes. Current `on-primary` values are designed for this exact use case (high-lightness on dark primary or vice versa), so risk is low.

**Prerequisite**: Confirm `text-on-primary` generates via UnoCSS. The token exists in `palette-registry.ts` as `on-primary` and in `app.css` as `--color-on-primary`. Need to verify `tokens.ts` exposes it. Currently it does NOT -- `on-primary` is missing from the colors map.

Add to `tokens.ts`:
```typescript
primary: {
    DEFAULT: 'var(--color-primary)',
    hover: 'var(--color-primary-hover)',
    light: 'var(--color-primary-light)',
    fg: 'var(--color-primary-fg)',
    bg: 'var(--color-primary-bg)',
},
onPrimary: 'var(--color-on-primary)',
```

**Fallback**: If `text-on-primary` extraction fails, use scoped CSS: `color: var(--color-on-primary)`.

### 3g. Homepage CTA link: `color-fg` to `color-primary` (HIGH)

File: `src/routes/(shell)/+page.svelte`

In scoped CSS (around line 632-634), change:
```css
.cta-link {
    font-size: var(--text-fluid-2xl);
    color: var(--color-fg);
```
to:
```css
.cta-link {
    font-size: var(--text-fluid-2xl);
    color: var(--color-primary);
```

### 3h. DiceRollButton expanded mode: add primary tint (MEDIUM)

File: `src/lib/components/shell/DiceRollButton.svelte`

Line 36, the expanded-mode classes include `text-muted`. Change to:
```
'gap-2 px-2 bg-transparent border-transparent rounded-md text-sm text-left w-full text-primary hover:bg-border hover:text-fg'
```

Wait -- this changes the button from muted to primary at rest, which may be too loud in the sidebar. **Alternative**: Change only the icon, not the label. This requires splitting the icon and label styling, which adds complexity.

**Recommendation**: Keep `text-muted` for the label. Add `text-primary` only to the icon span (line 45):
```svelte
<span class={cn('i-lucide-dices text-icon-md shrink-0 text-primary', style.rolling && 'animate-spin')}></span>
```

Revert icon to `text-muted` when in rail mode (icon-only) to avoid a bright icon in a compact space. The icon already uses no explicit color in rail mode, so adding `text-primary` only in expanded mode:
```svelte
<span class={cn('i-lucide-dices text-icon-md shrink-0', isExpanded && 'text-primary', style.rolling && 'animate-spin')}></span>
```

### 3i. Footer links: `hover:text-fg` to `hover:text-link` (MEDIUM)

File: `src/lib/components/shell/Footer.svelte`

Lines 15-18: Replace `hover:text-fg` with `hover:text-link` on all four interactive elements.

Before: `text-muted text-sm no-underline transition-colors duration-fast hover:text-fg`
After: `text-muted text-sm no-underline transition-colors duration-fast hover:text-link`

**Estimated scope**: ~30 line edits across 8 files.

---

## Phase 4: Shadow & Glow Fixes

**Dependency**: None (parallel with Phase 1-3)
**Files**: `src/app.css`, `src/lib/components/3d/SceneCard.svelte`

### 4a. `--shadow-glow-primary`: derive from palette

File: `src/app.css`

Line 51 (`:root`), change:
```css
--shadow-glow-primary: 0 4px 12px rgb(37 99 235 / 0.3);
```
to:
```css
--shadow-glow-primary: 0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent);
```

Line 200 (`.dark`), change:
```css
--shadow-glow-primary: 0 4px 12px rgb(96 165 250 / 0.3);
```
to:
```css
--shadow-glow-primary: 0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent);
```

**Note**: `color-mix` in box-shadow is supported in all modern browsers (baseline 2023). The `color-mix` pattern is already used elsewhere in this codebase (Badge, Checkbox, DropdownMenu).

### 4b. SceneCard dark glow: same fix as LinkCard 3b

File: `src/lib/components/3d/SceneCard.svelte`

Line 72, same pattern as Phase 3b:
```css
box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent),
            0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
```

**Estimated scope**: ~6 line edits across 3 files.

---

## Execution Order (Top-to-Bottom)

| Step | Phase | Action | Files |
|------|-------|--------|-------|
| 1 | 2a | Add `link?` and `accent?` to PaletteColors | `types.ts` |
| 2 | 2b | Add `--color-link`, `--color-accent` CSS vars | `app.css` |
| 3 | 2c | Add `link`, `accent`, `onPrimary` to UnoCSS colors | `tokens.ts` |
| 4 | 1 | Raise P1 structural chroma | `palette-registry.ts` + `app.css` |
| 5 | 1 | Raise P2 structural chroma | `palette-registry.ts` + `app.css` |
| 6 | 1 | Raise P3 structural chroma | `palette-registry.ts` + `app.css` |
| 7 | 4a | Fix `--shadow-glow-primary` | `app.css` |
| 8 | -- | **CHECKPOINT**: Build + visual validation. Cycle all 8 palettes, both modes. |
| 9 | 3a | LinkCard icon: `text-fg` to `text-primary` | `LinkCard.svelte` |
| 10 | 3b | LinkCard dark glow: palette-aware | `LinkCard.svelte` |
| 11 | 3c | LinkCard sublinks: `secondary-fg` to `link` | `LinkCard.svelte` |
| 12 | 3d | EmptyState icon: add primary tint | `EmptyState.svelte` |
| 13 | 3e | Badge default: verify/fix text-primary | `Badge.svelte` |
| 14 | 3f | Checkbox checked: `text-white` to `text-on-primary` | `Checkbox.svelte` |
| 15 | 3g | Homepage CTA: `color-fg` to `color-primary` | `+page.svelte` |
| 16 | 3h | DiceRollButton icon: conditional `text-primary` | `DiceRollButton.svelte` |
| 17 | 3i | Footer links: `hover:text-fg` to `hover:text-link` | `Footer.svelte` |
| 18 | 4b | SceneCard dark glow: palette-aware | `SceneCard.svelte` |
| 19 | -- | **FINAL**: Full visual regression across all palettes. |

---

## Files Changed Summary

| File | Phases | Nature of Change |
|------|--------|-----------------|
| `src/lib/styles/random/types.ts` | 2a | +2 optional fields |
| `src/lib/styles/tokens.ts` | 2c | +3 color entries |
| `src/app.css` | 1, 2b, 4a | ~80 chroma value edits, +4 new vars, 2 shadow fixes |
| `src/lib/styles/random/palette-registry.ts` | 1 | ~48 chroma value edits |
| `src/lib/components/composites/link-card/LinkCard.svelte` | 3a,3b,3c | 3 targeted edits |
| `src/lib/components/composites/empty-state/EmptyState.svelte` | 3d | 1 CSS rule change |
| `src/lib/components/primitives/badge/Badge.svelte` | 3e | Verify, possibly +1 CSS rule |
| `src/lib/components/primitives/checkbox/Checkbox.svelte` | 3f | 1 class swap |
| `src/routes/(shell)/+page.svelte` | 3g | 1 CSS value change |
| `src/lib/components/shell/DiceRollButton.svelte` | 3h | 1 conditional class add |
| `src/lib/components/shell/Footer.svelte` | 3i | 4 class swaps |
| `src/lib/components/3d/SceneCard.svelte` | 4b | 1 CSS value change |

**Total**: 12 files, ~150 line edits. No new files. No interface breaks. No migration needed.

---

## What This Plan Does NOT Do

- **Does not touch P0** (High Contrast) -- achromatic by design, must stay at chroma 0
- **Does not touch P4-P7** -- already have adequate structural chroma (0.04-0.08)
- **Does not add palette-specific link/accent overrides** -- deferred until visual testing shows they are needed. The CSS variable fallback chain (`--color-link` defaults to `--color-primary`) handles this cleanly.
- **Does not change `fg`, `body`, or `primary-*` tokens** -- these already have sufficient chroma across all palettes
