---
name: design-system
description: Velociraptor design system rules for consistent UI. Use when building components, styling elements, choosing spacing/padding/margin, sizing icons, or creating layouts. Enforces zero-margin components, gap-based layouts, 8px scale, and icon tokens. Essential for any UI work. (project)
---

# Velociraptor Design System

Strict rules for consistent UI. Zero margin on components. Gap on containers. Fixed token scale. Single source of truth.

## Contents

- [Token Architecture](#token-architecture) - Where tokens live
- [Core Principle](#core-principle) - Who owns spacing
- [Six Rules](#six-rules) - Mandatory patterns
- [Spacing Scale](#spacing-scale) - Fixed 8px tokens
- [Icon Sizes](#icon-sizes) - Standard tokens
- [Component Map](#component-map) - Standard padding
- [Container Map](#container-map) - Standard gaps
- [Layout Primitives](#layout-primitives) - Stack, Cluster, Grid
- [Anti-Patterns](#anti-patterns) - What to avoid
- [References](#references) - Detailed guides

## Token Architecture

**Two-file pattern (2024-2025 industry standard):**

```
src/app.css              ← Colors, shadows (runtime CSS variables)
src/lib/styles/tokens.ts ← References + non-colors (build-time)
```

| Token Type | Source of Truth | Reason |
|------------|-----------------|--------|
| Colors | `app.css` | Runtime dark mode toggle |
| Shadows | `app.css` | Theme-aware |
| Spacing | `tokens.ts` | Static, build-time |
| Typography | `tokens.ts` | Static, build-time |
| Breakpoints | `tokens.ts` | Static, UnoCSS + JS |

**Critical rule:** Never duplicate values between files.

```typescript
// tokens.ts - REFERENCES for colors, VALUES for non-colors
export const colors = {
  primary: 'var(--color-primary)',  // ← reference only
} as const;

export const spacing = {
  '4': '0.75rem',  // ← actual value
} as const;
```

See `references/token-architecture.md` for full details.

## Core Principle

**Components control padding (internal). Parents control margin/gap (external).**

Components don't know about siblings. Containers handle layout.

## Six Rules

| # | Rule | Summary |
|---|------|---------|
| 1 | Zero Component Margins | Buttons, cards, inputs: no `m-*` classes |
| 2 | Gap Over Margin | Use `gap-*` on containers, not `mr-*` on children |
| 3 | Fixed 8px Scale | Spacing: 2, 4, 8, 12, 16, 24, 32, 48px |
| 4 | Fluid for Layout | Page sections use `fluid-*` tokens |
| 5 | Icon Size Tokens | `text-icon-sm/md/lg/xl` - no arbitrary sizes |
| 6 | Layout Primitives | Stack/Cluster/Grid own child spacing |

## Spacing Scale

Fixed 8px-based tokens for padding, gap, margin.

| Token | Pixels | Rem | Use |
|-------|--------|-----|-----|
| `0` | 0 | 0 | Reset |
| `1` | 2px | 0.125rem | Hairline |
| `2` | 4px | 0.25rem | Tight |
| `3` | 8px | 0.5rem | Input padding, tight lists |
| `4` | 12px | 0.75rem | Button horizontal |
| `5` | 16px | 1rem | Card padding, default |
| `6` | 24px | 1.5rem | Comfortable cards |
| `7` | 32px | 2rem | Section spacing |
| `8` | 48px | 3rem | Large sections |

**No arbitrary values.** Never `p-[13px]` or `gap-[17px]`.

## Icon Sizes

| Token | Size | Context |
|-------|------|---------|
| `text-icon-sm` | 16px (1rem) | Inline text, small buttons |
| `text-icon-md` | 20px (1.25rem) | Form inputs, triggers |
| `text-icon-lg` | 24px (1.5rem) | Navigation, standard buttons |
| `text-icon-xl` | 32px (2rem) | Headers, decorative |

```svelte
<!-- WRONG -->
<span class="i-lucide-home text-[1.75rem]"></span>

<!-- RIGHT -->
<span class="i-lucide-home text-icon-lg"></span>
```

## Component Map

Standard internal padding.

| Component | Padding | Notes |
|-----------|---------|-------|
| Button (default) | `px-4 py-2` | 12px horizontal, 8px vertical |
| Button (small) | `px-3 py-1` | Toolbars, compact UI |
| Button (large) | `px-6 py-3` | Hero CTAs |
| Input | `px-3 py-2` | Matches small button |
| Card (compact) | `p-5` | 16px |
| Card (comfortable) | `p-6` | 24px |
| List item | `py-2 px-3` | Scannable |
| Modal | `p-6` | Frame content |

## Container Map

Standard gaps for flex/grid layouts.

| Context | Gap | Example |
|---------|-----|---------|
| Tight list | `gap-2` | Checkboxes, tags |
| Form fields | `gap-4` | Standard vertical rhythm |
| Card grid | `gap-5` | Breathing room |
| Page sections | `gap-7` | Clear breaks |
| Hero | `gap-8` | Dramatic |

## Layout Primitives

Use these instead of raw flex/grid with margin.

### Stack (Vertical)

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    gap?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
    children: Snippet;
  }

  let { gap = '4', children }: Props = $props();
</script>

<div class="flex flex-col gap-{gap}">
  {@render children()}
</div>
```

### Cluster (Horizontal, Wrapping)

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    gap?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
    justify?: 'start' | 'center' | 'end' | 'between';
    children: Snippet;
  }

  let { gap = '3', justify = 'start', children }: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-{gap} justify-{justify}">
  {@render children()}
</div>
```

### Usage

```svelte
<Stack gap="4">
  <Card>First</Card>
  <Card>Second</Card>
</Stack>

<Cluster gap="3" justify="between">
  <Button>Cancel</Button>
  <Button>Submit</Button>
</Cluster>
```

## Anti-Patterns

### Margin on Components

```svelte
<!-- NEVER -->
<Card class="mb-4">Content</Card>

<!-- DO -->
<Stack gap="4">
  <Card>Content 1</Card>
  <Card>Content 2</Card>
</Stack>
```

### Margin on Flex Children

```svelte
<!-- NEVER -->
<div class="flex">
  <div class="mr-4">First</div>
  <div>Second</div>
</div>

<!-- DO -->
<div class="flex gap-4">
  <div>First</div>
  <div>Second</div>
</div>
```

### Arbitrary Icon Sizes

```svelte
<!-- NEVER -->
<span class="i-lucide-settings text-[1.3rem]"></span>

<!-- DO -->
<span class="i-lucide-settings text-icon-md"></span>
```

### Arbitrary Spacing

```svelte
<!-- NEVER -->
<button class="p-[13px]">Submit</button>

<!-- DO -->
<button class="px-4 py-2">Submit</button>
```

### Duplicating Token Values

```typescript
// NEVER - same value in both files
// app.css: --color-primary: #2563eb;
// tokens.ts:
export const colorValues = {
  primary: '#2563eb',  // ← DUPLICATION, will drift
};

// DO - reference in tokens.ts, value in app.css only
export const colors = {
  primary: 'var(--color-primary)',  // ← reference
} as const;
```

## Code Review Checklist

- [ ] No `m-*` on buttons, cards, inputs
- [ ] No `mr-*`/`mb-*` on flex/grid children
- [ ] No arbitrary values: `p-[17px]`, `text-[1.3rem]`
- [ ] No hardcoded hex colors: `text-[#ff0000]`, `bg-[#123456]`
- [ ] Icons use `text-icon-*` tokens
- [ ] Containers use `gap-*`, not margin on children
- [ ] Colors use semantic tokens: `text-primary`, `bg-error-light`
- [ ] New colors added to `app.css` only, referenced in `tokens.ts`

## References

See `references/` for detailed guides:
- `token-architecture.md` - Single source of truth pattern (CSS vs TS)
- `spacing.md` - Complete spacing token system
- `icons.md` - Icon sizing patterns
- `layout-primitives.md` - Stack, Cluster, Grid implementations

See also:
- `src/app.css` - Runtime tokens (colors, shadows, z-index)
- `src/lib/styles/tokens.ts` - Build-time tokens + color references
- `docs/blueprint/design/tokens.md` - Full token documentation
