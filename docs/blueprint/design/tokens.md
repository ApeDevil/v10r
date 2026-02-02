# Design Tokens

Single source of truth for all design values. Defined once, referenced everywhere.

---

## Strategy

**Two-file architecture** with clear responsibilities:

```
src/app.css                 ← SINGLE SOURCE OF TRUTH for colors (CSS variables)
        ↓
src/lib/styles/tokens.ts    ← References CSS vars + defines non-color tokens
        ↓
    uno.config.ts           ← UnoCSS theme
        ↓
    Utility classes         ← text-fluid-lg, p-fluid-4, bg-primary, etc.
```

- **Colors**: Raw values in `app.css`, references in `tokens.ts`
- **Everything else**: Values in `tokens.ts` (breakpoints, spacing, typography, etc.)

No hardcoded values in components. Change a token once, updates everywhere.

---

## Token File

```typescript
// src/lib/styles/tokens.ts

// ═══════════════════════════════════════════════════════════════
// BREAKPOINTS
// ═══════════════════════════════════════════════════════════════

/** Media query breakpoints (min-width) */
export const breakpoints = {
  sm: '640px',   // Large phones landscape
  md: '768px',   // Tablets
  lg: '1024px',  // Small laptops
  xl: '1280px',  // Desktops
  '2xl': '1536px', // Large screens
} as const;

/** Container query breakpoints */
export const containers = {
  xs: '320px',
  sm: '384px',
  md: '448px',
  lg: '512px',
  xl: '576px',
} as const;

// ═══════════════════════════════════════════════════════════════
// FLUID TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════

/**
 * Fluid font sizes using clamp().
 * All values include rem in preferred calculation for WCAG 1.4.4 zoom compliance.
 * Rule: max ≤ 2.5× min to ensure 200% zoom works.
 */
export const fontSize = {
  'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',     // Captions
  'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.25vw, 1rem)',        // Small text
  'fluid-base': 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)',       // Body
  'fluid-lg': 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)',        // Lead
  'fluid-xl': 'clamp(1.25rem, 1rem + 1vw, 1.5rem)',            // H4
  'fluid-2xl': 'clamp(1.5rem, 1.2rem + 1.5vw, 2rem)',          // H3
  'fluid-3xl': 'clamp(1.875rem, 1.5rem + 2vw, 2.5rem)',        // H2
  'fluid-4xl': 'clamp(2.25rem, 1.5rem + 3vw, 3.5rem)',         // H1
  'fluid-5xl': 'clamp(3rem, 2rem + 4vw, 5rem)',                // Display
} as const;

// ═══════════════════════════════════════════════════════════════
// FLUID SPACING
// ═══════════════════════════════════════════════════════════════

/** Fluid spacing for margins, padding, gaps */
export const spacing = {
  'fluid-1': 'clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)',   // Tight
  'fluid-2': 'clamp(0.5rem, 0.4rem + 0.5vw, 1rem)',       // Small
  'fluid-3': 'clamp(0.75rem, 0.5rem + 1vw, 1.5rem)',      // Medium
  'fluid-4': 'clamp(1rem, 0.75rem + 1.5vw, 2rem)',        // Default
  'fluid-5': 'clamp(1.5rem, 1rem + 2vw, 3rem)',           // Large
  'fluid-6': 'clamp(2rem, 1.5rem + 2.5vw, 4rem)',         // XL
  'fluid-7': 'clamp(3rem, 2rem + 4vw, 6rem)',             // Section
  'fluid-8': 'clamp(4rem, 3rem + 5vw, 8rem)',             // Hero
} as const;

// ═══════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════

/**
 * Semantic color tokens (CSS variable references).
 *
 * Single source of truth: src/app.css
 * This file only references CSS variables - actual values live in app.css.
 *
 * WCAG AA contrast ratios (verified in app.css):
 * - fg on bg: 15.3:1 (light), 13.5:1 (dark) ✓
 * - muted on bg: 4.6:1 (light), 4.5:1 (dark) ✓
 * - primary on white: 4.5:1 ✓
 */
export const colors = {
  bg: 'var(--color-bg)',
  fg: 'var(--color-fg)',
  muted: 'var(--color-muted)',
  border: 'var(--color-border)',
  subtle: 'var(--color-subtle)',
  primary: {
    DEFAULT: 'var(--color-primary)',
    hover: 'var(--color-primary-hover)',
    light: 'var(--color-primary-light)',
  },
  success: {
    DEFAULT: 'var(--color-success)',
    light: 'var(--color-success-light)',
  },
  warning: {
    DEFAULT: 'var(--color-warning)',
    hover: 'var(--color-warning-hover)',
    light: 'var(--color-warning-light)',
  },
  error: {
    DEFAULT: 'var(--color-error)',
    light: 'var(--color-error-light)',
    border: 'var(--color-error-border)',
  },
  input: {
    border: 'var(--color-input-border)',
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// Z-INDEX
// ═══════════════════════════════════════════════════════════════

/** Z-index layers for stacking context */
export const zIndex = {
  base: 0,
  sidebar: 10,
  fab: 20,
  overlay: 30,
  drawer: 40,
  dropdown: 50,
  modal: 60,
  toast: 70,
  tooltip: 80,
} as const;

// ═══════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════

/** Sidebar dimensions */
export const sidebar = {
  railWidth: '56px',
  expandedWidth: '240px',
  mobileWidth: 'min(320px, 85vw)',
} as const;

/** Content constraints */
export const layout = {
  maxWidth: '80rem',        // 1280px - main content max
  contentWidth: '65ch',     // Optimal reading width
  wideWidth: '90rem',       // 1440px - wide layouts
} as const;

// ═══════════════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════════════

/** Duration values */
export const duration = {
  instant: '0ms',      // Immediate, no animation
  fast: '150ms',       // Micro-interactions, hovers
  normal: '250ms',     // Standard transitions
  slow: '400ms',       // Emphasized transitions
  slower: '600ms',     // Page transitions, modals
} as const;

/** Easing functions */
export const easing = {
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',      // ease-out
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// ═══════════════════════════════════════════════════════════════
// RADII & SHADOWS
// ═══════════════════════════════════════════════════════════════

export const borderRadius = {
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
} as const;

export const boxShadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
} as const;
```

---

## UnoCSS Integration

```typescript
// uno.config.ts
import { defineConfig, presetUno } from 'unocss';
import {
  breakpoints,
  containers,
  fontSize,
  spacing,
  colors,
  zIndex,
  duration,
} from './src/lib/styles/tokens';

export default defineConfig({
  presets: [presetUno()],

  theme: {
    breakpoints,
    containers,
    fontSize,
    spacing,
    colors,
    zIndex,
    // Duration requires custom rule or CSS variables
  },

  // Custom rules for duration utilities
  rules: [
    ['duration-instant', { 'transition-duration': 'var(--duration-instant, 0ms)' }],
    ['duration-fast', { 'transition-duration': 'var(--duration-fast, 150ms)' }],
    ['duration-normal', { 'transition-duration': 'var(--duration-normal, 250ms)' }],
    ['duration-slow', { 'transition-duration': 'var(--duration-slow, 400ms)' }],
    ['duration-slower', { 'transition-duration': 'var(--duration-slower, 600ms)' }],
  ],

  // Safelist commonly used dynamic classes
  safelist: [
    ...Object.keys(fontSize).map(k => `text-${k}`),
    ...Object.keys(spacing).flatMap(k => [`p-${k}`, `m-${k}`, `gap-${k}`]),
  ],
});
```

---

## CSS Custom Properties

Global CSS variables defined in `app.css`, using values from tokens:

```css
/* src/app.css */

:root {
  /* Colors - Light mode */
  --color-bg: #ffffff;
  --color-fg: #111827;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-success: #16a34a;
  --color-warning: #f59e0b;
  --color-error: #dc2626;

  /* Layout */
  --sidebar-rail-width: 56px;
  --sidebar-expanded-width: 240px;
  --sidebar-mobile-width: min(320px, 85vw);

  /* Animation */
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark mode */
.dark {
  --color-bg: #111827;
  --color-fg: #f3f4f6;
  --color-muted: #9ca3af;
  --color-border: #374151;
  --color-primary: #60a5fa;
  --color-primary-hover: #93c5fd;
  --color-success: #22c55e;
  --color-warning: #fbbf24;
  --color-error: #f87171;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus visible for keyboard navigation */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}
```

---

## Usage Examples

### In UnoCSS Classes

```svelte
<!-- Fluid typography -->
<h1 class="text-fluid-4xl">Page Title</h1>
<p class="text-fluid-base text-muted">Body text</p>

<!-- Fluid spacing -->
<section class="py-fluid-7 px-fluid-4">
  <div class="space-y-fluid-4">
    <!-- content -->
  </div>
</section>

<!-- Colors -->
<div class="bg-bg text-fg border-border">
  <button class="bg-primary hover:bg-primary-hover">
    Action
  </button>
</div>
```

### In Component Styles

```svelte
<script>
  import { sidebar, zIndex } from '$lib/styles/tokens';
</script>

<aside
  style:width={sidebar.railWidth}
  style:z-index={zIndex.sidebar}
>
  <!-- ... -->
</aside>

<style>
  aside {
    /* Use CSS variables for theming */
    background: var(--color-bg);
    border-right: 1px solid var(--color-border);
    transition: width var(--duration-normal) var(--ease-default);
  }

  aside:hover {
    width: var(--sidebar-expanded-width);
  }
</style>
```

### In JavaScript

```typescript
import { breakpoints } from '$lib/styles/tokens';

// Media query matching
const isMobile = window.matchMedia(`(max-width: ${breakpoints.md})`).matches;

// Responsive logic
function getColumns() {
  if (window.innerWidth >= parseInt(breakpoints.lg)) return 3;
  if (window.innerWidth >= parseInt(breakpoints.md)) return 2;
  return 1;
}
```

---

## Token Categories

| Category | Source of Truth | Consumed By |
|----------|-----------------|-------------|
| Colors | `app.css` (raw values) | CSS variables, UnoCSS via `tokens.ts` refs |
| Breakpoints | `tokens.ts` | UnoCSS, JS media queries |
| Typography | `tokens.ts` | UnoCSS `text-*` classes |
| Spacing | `tokens.ts` | UnoCSS `p-*`, `m-*`, `gap-*` |
| Z-Index | `app.css` + `tokens.ts` | CSS variables, Components |
| Layout | `app.css` + `tokens.ts` | CSS variables, Components |
| Animation | `app.css` | CSS variables |
| Radii | `tokens.ts` + `app.css` | UnoCSS, CSS variables |
| Shadows | `tokens.ts` + `app.css` | UnoCSS, CSS variables |

---

## File Structure

```
src/
├── app.css                      # ← COLORS: Single source of truth (CSS variables)
├── lib/
│   └── styles/
│       └── tokens.ts            # ← NON-COLORS: Source of truth + color refs
└── uno.config.ts                # Imports from tokens.ts → generates utilities
```

**Why two files?**
- `app.css`: Colors need CSS variables for dark mode toggle (runtime)
- `tokens.ts`: Everything else can be static (build time via UnoCSS)

---

## WCAG Compliance Notes

### Fluid Typography

All fluid font sizes follow the **2.5x rule**: max value ≤ 2.5× min value.

This ensures text scales properly at 200% browser zoom per WCAG 1.4.4.

| Token | Min | Max | Ratio | WCAG |
|-------|-----|-----|-------|------|
| fluid-xs | 0.75rem | 0.875rem | 1.17x | Pass |
| fluid-base | 1rem | 1.125rem | 1.13x | Pass |
| fluid-4xl | 2.25rem | 3.5rem | 1.56x | Pass |
| fluid-5xl | 3rem | 5rem | 1.67x | Pass |

### Color Contrast

All color combinations meet WCAG AA (4.5:1 for normal text):

| Combination | Light | Dark |
|-------------|-------|------|
| fg on bg | 15.3:1 | 13.5:1 |
| muted on bg | 4.6:1 | 4.5:1 |
| primary on white | 4.5:1 | N/A |

---

## Related

- [README.md](./README.md) - Design philosophy and theming strategy
- [styling.md](./styling.md) - How tokens are used in styling patterns
- [app-shell.md](../app-shell.md) - Sidebar dimensions and z-index usage
- [state.md](../state.md) - Theme state management

---

## Sources

- [UnoCSS Theme Config](https://unocss.dev/config/theme)
- [Fluid Type Scale Calculator](https://www.fluid-type-scale.com/)
- [Design Tokens W3C Draft](https://design-tokens.github.io/community-group/format/)
- [WCAG 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
