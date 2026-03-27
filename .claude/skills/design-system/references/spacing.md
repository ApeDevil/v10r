# Spacing Token System

Complete spacing rules for Velociraptor.

## Core Principle

**Components own padding. Parents own gap.**

| Responsibility | Owner | CSS Property |
|----------------|-------|--------------|
| Internal space | Component | `padding` |
| Between siblings | Container | `gap` |
| Position adjustment | Rare/Layout | `margin` |

## Fixed Scale (8px Base)

Industry standard from Carbon, Material, Atlassian.

| Token | Value | Rem | Typical Use |
|-------|-------|-----|-------------|
| `0` | 0px | 0 | Reset spacing |
| `1` | 2px | 0.125rem | Hairline dividers |
| `2` | 4px | 0.25rem | Tight spacing, icon gaps |
| `3` | 8px | 0.5rem | Input padding, dense lists |
| `4` | 12px | 0.75rem | Button horizontal padding |
| `5` | 16px | 1rem | Default padding, form gaps |
| `6` | 24px | 1.5rem | Comfortable card padding |
| `7` | 32px | 2rem | Section spacing |
| `8` | 48px | 3rem | Page section breaks |

## Fluid Scale (Responsive)

For page-level spacing that scales with viewport.

| Token | Clamp Range | Use |
|-------|-------------|-----|
| `fluid-1` | 4px → 8px | Minimal responsive |
| `fluid-2` | 8px → 16px | Tight responsive |
| `fluid-3` | 12px → 24px | Standard responsive |
| `fluid-4` | 16px → 32px | Comfortable responsive |
| `fluid-5` | 24px → 48px | Section responsive |
| `fluid-6` | 32px → 64px | Large section |
| `fluid-7` | 48px → 96px | Hero sections |
| `fluid-8` | 64px → 128px | Major breaks |

**Rule:** Fixed for components, fluid for page layout.

## Gap vs Margin

### Why Gap Wins

| Feature | Margin | Gap |
|---------|--------|-----|
| Edge behavior | Creates unwanted outer space | Only between items |
| Collapsing | Yes (unpredictable) | No |
| Last child | Need to remove | Automatic |
| Direction | Applied to children | Applied to parent |

### When to Use Each

```svelte
<!-- GAP: Sibling spacing in flex/grid -->
<div class="flex gap-4">
  <Button>One</Button>
  <Button>Two</Button>
</div>

<!-- PADDING: Internal component space -->
<div class="p-6">
  <h2>Card Title</h2>
  <p>Card content</p>
</div>

<!-- MARGIN: Rare - single element positioning -->
<div class="mt-auto">Pushed to bottom</div>
```

## Component Padding Standards

### Buttons

| Size | Classes | Pixels |
|------|---------|--------|
| Small | `px-3 py-1` | 8px × 4px |
| Default | `px-4 py-2` | 12px × 8px |
| Large | `px-6 py-3` | 24px × 12px |

### Inputs

| Type | Classes | Notes |
|------|---------|-------|
| Text input | `px-3 py-2` | Match small button height |
| Textarea | `p-3` | Equal all sides |
| Select | `px-3 py-2` | Room for chevron |

### Cards

| Density | Classes | Pixels |
|---------|---------|--------|
| Compact | `p-4` | 16px |
| Default | `p-5` | 16px (1rem) |
| Comfortable | `p-6` | 24px |

### Modals/Dialogs

| Area | Classes |
|------|---------|
| Container | `p-6` |
| Header | `pb-4` |
| Footer | `pt-4` |
| Between sections | `gap-4` |

## Container Gap Standards

### Lists & Groups

| Context | Gap | Example |
|---------|-----|---------|
| Tag cloud | `gap-2` | Compact chip groups |
| Checkbox group | `gap-2` | Form options |
| Navigation items | `gap-1` | Sidebar nav |
| Toolbar buttons | `gap-2` | Action bar |

### Forms

| Context | Gap |
|---------|-----|
| Form fields (vertical) | `gap-4` |
| Field + label | `gap-1` |
| Field + error | `gap-1` |
| Form sections | `gap-6` |

### Page Layout

| Context | Gap |
|---------|-----|
| Card grid | `gap-5` |
| Content sections | `gap-7` |
| Page major sections | `gap-8` |
| Hero → content | `gap-8` |

## Implementation

### tokens.ts

```typescript
export const spacing = {
  '0': '0',
  '1': '0.125rem',
  '2': '0.25rem',
  '3': '0.5rem',
  '4': '0.75rem',
  '5': '1rem',
  '6': '1.5rem',
  '7': '2rem',
  '8': '3rem',
} as const;

export const fluidSpacing = {
  'fluid-1': 'clamp(0.25rem, 0.5vw, 0.5rem)',
  'fluid-2': 'clamp(0.5rem, 1vw, 1rem)',
  'fluid-3': 'clamp(0.75rem, 1.5vw, 1.5rem)',
  'fluid-4': 'clamp(1rem, 2vw, 2rem)',
  'fluid-5': 'clamp(1.5rem, 3vw, 3rem)',
  'fluid-6': 'clamp(2rem, 4vw, 4rem)',
  'fluid-7': 'clamp(3rem, 6vw, 6rem)',
  'fluid-8': 'clamp(4rem, 8vw, 8rem)',
} as const;
```

### uno.config.ts

```typescript
theme: {
  spacing: {
    ...spacing,
    ...fluidSpacing,
  },
},
safelist: [
  // Common gaps
  'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-5', 'gap-6', 'gap-7', 'gap-8',
  // Common padding
  'p-2', 'p-3', 'p-4', 'p-5', 'p-6',
  'px-3', 'px-4', 'px-6',
  'py-1', 'py-2', 'py-3',
],
```

## Enforcement

### ESLint (if using)

```json
{
  "rules": {
    "tailwindcss/no-arbitrary-value": "error"
  }
}
```

### Code Review

Reject PRs with:
- `m-*` on buttons, cards, inputs
- `mr-*`/`mb-*` on flex children
- Arbitrary values like `p-[17px]`

## References

- [Carbon Design System - Spacing](https://carbondesignsystem.com/guidelines/spacing/overview/)
- [Material Design 3 - Layout](https://m3.material.io/foundations/layout/understanding-layout/spacing)
- [Every Layout - The Stack](https://every-layout.dev/layouts/stack/)
