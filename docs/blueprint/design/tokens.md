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
// ICON SIZES
// ═══════════════════════════════════════════════════════════════

/** Icon sizes — use text-icon-* classes (merged into fontSize in uno.config). */
export const iconSize = {
  'icon-sm': '1rem',    // 16px - Inline text, small buttons, dense UI
  'icon-md': '1.25rem', // 20px - Form inputs, triggers, medium buttons
  'icon-lg': '1.5rem',  // 24px - Navigation, standard buttons (most common)
  'icon-xl': '2rem',    // 32px - Section headers, decorative
} as const;

// ═══════════════════════════════════════════════════════════════
// FONT FAMILY
// ═══════════════════════════════════════════════════════════════

/** Font family tokens (CSS variable refs, set by data-typography attribute) */
export const fontFamily = {
  heading: 'var(--font-heading, system-ui, sans-serif)',
  body: 'var(--font-body, system-ui, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, monospace)',
} as const;

// ═══════════════════════════════════════════════════════════════
// FIXED & FLUID SPACING
// ═══════════════════════════════════════════════════════════════

/**
 * Fixed spacing scale (keys 0-8). These REPLACE UnoCSS defaults — values
 * differ from Tailwind (e.g. 1=2px, 7=32px, 8=48px). Use for component
 * padding, gaps, margins.
 */
export const fixedSpacing = {
  '0': '0',
  '1': '0.125rem', // 2px  - Hairline
  '2': '0.25rem',  // 4px  - Tight
  '3': '0.5rem',   // 8px  - Input padding, dense lists
  '4': '0.75rem',  // 12px - Button horizontal padding
  '5': '1rem',     // 16px - Default padding, form gaps
  '6': '1.5rem',   // 24px - Comfortable card padding
  '7': '2rem',     // 32px - Section spacing
  '8': '3rem',     // 48px - Large sections
} as const;

/** Fluid spacing for page-level layout (scales with viewport) */
export const fluidSpacing = {
  'fluid-1': 'clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)',   // Tight
  'fluid-2': 'clamp(0.5rem, 0.4rem + 0.5vw, 1rem)',       // Small
  'fluid-3': 'clamp(0.75rem, 0.5rem + 1vw, 1.5rem)',      // Medium
  'fluid-4': 'clamp(1rem, 0.75rem + 1.5vw, 2rem)',        // Default
  'fluid-5': 'clamp(1.5rem, 1rem + 2vw, 3rem)',           // Large
  'fluid-6': 'clamp(2rem, 1.5rem + 2.5vw, 4rem)',         // XL
  'fluid-7': 'clamp(3rem, 2rem + 4vw, 6rem)',             // Section
  'fluid-8': 'clamp(4rem, 3rem + 5vw, 8rem)',             // Hero
} as const;

/** Combined spacing (fixed + fluid) for UnoCSS theme */
export const spacing = { ...fixedSpacing, ...fluidSpacing } as const;

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
  body: 'var(--color-body)',
  heading: 'var(--color-heading)',
  muted: 'var(--color-muted)',
  border: 'var(--color-border)',
  subtle: 'var(--color-subtle)',
  primary: {
    DEFAULT: 'var(--color-primary)',
    hover: 'var(--color-primary-hover)',
    container: 'var(--color-primary-container)',
    dim: 'var(--color-primary-dim)',
  },
  'on-primary': {
    DEFAULT: 'var(--color-on-primary)',
    container: 'var(--color-on-primary-container)',
  },
  secondary: { DEFAULT: 'var(--color-secondary)' },
  'on-secondary': 'var(--color-on-secondary)',
  accent: {
    DEFAULT: 'var(--color-accent)',
    hover: 'var(--color-accent-hover)',
    container: 'var(--color-accent-container)',
  },
  'on-accent': {
    DEFAULT: 'var(--color-on-accent)',
    container: 'var(--color-on-accent-container)',
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
  info: {
    DEFAULT: 'var(--color-info)',
    light: 'var(--color-info-light)',
  },
  input: {
    DEFAULT: 'var(--color-input)',
    border: 'var(--color-input-border)',
  },
  // Semi-transparent variants (derived via color-mix in app.css)
  bgAlpha: 'var(--color-bg-alpha)',
  fgAlpha: 'var(--color-fg-alpha)',
  // Elevation surfaces (higher number = higher elevation)
  surface: {
    1: 'var(--surface-1)', // Raised - cards, panels
    2: 'var(--surface-2)', // Overlay - dropdowns, popovers
    3: 'var(--surface-3)', // Modal - highest elevation
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// Z-INDEX
// ═══════════════════════════════════════════════════════════════

/** Z-index layers — numeric SSOT lives in app.css; tokens.ts holds var() references */
export const zIndex = {
  base: 'var(--z-base)',         // 0
  sidebar: 'var(--z-sidebar)',   // 10
  fab: 'var(--z-fab)',           // 20
  panel: 'var(--z-panel)',       // 25 — non-modal docked (chatbot dock, selection bar)
  overlay: 'var(--z-overlay)',   // 30 — ALL modal scrims
  drawer: 'var(--z-drawer)',     // 40 — mobile sidebar drawer
  popover: 'var(--z-popover)',   // 50 — anchored floating (dropdown = alias)
  modal: 'var(--z-modal)',       // 60
  toast: 'var(--z-toast)',       // 70
  tooltip: 'var(--z-tooltip)',   // 80
  progress: 'var(--z-progress)', // 100
} as const;
```

## Surface (Tonal) Elevation

Depth cue for stacked surfaces (sidebar → menu → panel → dialog): three independent CSS
channels layered on `[data-elevation="1..4"]`, decoupled from z-index (stacking order is
the `zIndex` table above; this section is tone only). Geometry — max-w/max-h/overflow/
collision — comes from `floatingContentBase` in `$lib/styles/floating.ts`.

### The model: relative, no floors

The app background is level 0 (`--surface-0`, no attribute). Every surface's level is its
**parent's level + 1** — resolved once at init via Svelte context, never a hardcoded rung.
The engine lives in `$lib/styles/elevation.ts` (pure `.ts`, no runes, SSR-safe):

```typescript
export const ELEVATION_CEILING = 4;

getParentLevel(): number                  // ambient level from context, or 0 — read-only
resolveLevel(opts, parent?): number       // opts.level ?? parent + 1
elevationAttr(level): string | undefined  // clamp to ceiling; undefined at level ≤ 0
useSurface(opts): { depth, display, attrs }
```

`useSurface()` is the entry point: it resolves this surface's depth (`parent + 1`, or
`opts.level` for a rare reset root), seeds context with the depth **unclamped** so a child
computes an honest `+1` past the ceiling, and returns `attrs = { 'data-elevation':
String(display) }` (`display` clamped to `ELEVATION_CEILING`, omitted at level 0).

Two call sites:
- **`<Surface>`** (`$lib/components/layout/Surface.svelte`, barrel-exported) — page/layout
  code: `<Surface as="section">…</Surface>`.
- **`useSurface()` directly** — primitives that stamp elevation onto a Bits `.Content`
  they don't otherwise wrap, avoiding an extra DOM node.

### Why context, not a DOM/CSS counter

Bits UI portals floating content (menus, dialogs, tooltips) onto `<body>`, so a portalled
surface's DOM parent is the page, not its trigger — a CSS/DOM counter would collapse every
portal to level 0. Svelte context follows the **component** tree, not the DOM: the level
resolved at the trigger — a real ancestor in the render tree — survives the portal,
because Svelte resolves context by render-tree position, not lexical scope.

### The three channels

| Channel | Token | Role |
|---------|-------|------|
| **Fill** | `--eN-bg` | Tonal background. Monotonic — lightens toward pure white at E4 in light mode, darkens toward near-black in dark mode. |
| **Rim** | `--eN-border` | Load-bearing separator — the one channel guaranteed to step any parent/child pair apart regardless of absolute depth. Clears ≥3:1 at every covered boundary in both modes (E1 is relaxed in light, where a cast shadow also separates); the only cue that survives `forced-colors` and near-zero dark-mode fill deltas. |
| **Glow** | `--eN-shadow` | Decorative, brand-tinted bloom — not a plain grey drop-shadow. De-tuned resting hue, resting opacity ≤18%, firewalled below the `--glow-active` interaction band (≥20% primary) so a resting surface never reads as hovered. A static box-shadow, so it survives `prefers-reduced-motion` by construction. Blur capped ≤24px. |

An element carrying `data-elevation` must not also carry `bg-*`/`shadow-*`/`border-color`
utilities — border width and radius stay on the component. (The old grain/texture fill
channel was retired; it's not a live channel.)

### Past the ceiling

`ELEVATION_CEILING = 4` — tone saturates at E4 (`display` clamps), but the seeded context
keeps counting unclamped, so a surface nested past E4 still computes an honest `parent +
1`. Once tone can no longer distinguish rungs, z-order, physical overlap, and the rim
carry the separation.

### Consumer patterns

- **Providers seed a plane without displaying one.** `SidebarRail` calls `useSurface()`
  for the `setContext` side-effect only (keeps its own `bg-surface-1` look, ignores
  `attrs`) → seeds level 1 for its children. Dock panels seed their plane the same way.
- **Recursive components never call `useSurface()`.** `explorer/TreeNode.svelte` uses
  read-only `getParentLevel() + 1` so every node's menu resolves to the same `plane + 1`;
  calling `useSurface()` there would compound elevation with recursion depth.
- **Nested sub-menus** (`DockLeafMenu`, `UserMenu`) compute `parent + 1` for their
  sub-content instead of a fixed rung — this fixed an old bug where a rail submenu jumped
  E2→E4; it's now E2→E3.

### Accessibility

- `forced-colors: active` — the UA strips `background-color` and `box-shadow`, so fill and
  glow vanish; every `[data-elevation]` gets a real border instead (1px, 2px for E3/E4).
- `prefers-contrast: more` — flattens the rim to `--color-border` and collapses the glow to
  its first shadow layer (the soft bloom otherwise lowers perceived edge contrast).
- `prefers-reduced-motion` — kills interaction transitions; the resting glow is unaffected,
  since it was never animated.
- Elevation is never the sole carrier of meaning — dialogs still announce
  `role`/`aria-modal` and trap focus, since rung order isn't recoverable once
  `forced-colors` flattens every border to `CanvasText`.

### Status

Fully migrated: every production consumer resolves its rung relatively. `ApproveDialog`
and `MetadataApprovalDialog` were the last hardcoded stragglers and are now migrated. Zero
hardcoded `data-elevation` literals remain outside the showcase's own teaching demos
(`ElevationSection`, `RungStack`, `ContrastReadout` at `/showcases/ui/layouts`, which
hardcode rungs deliberately to teach the ladder). E2E-verified via the Chrome extension
and `vr v` green.

### Dismissal order (a separate system)

Rung is tone, not stacking control. Dismissal order is owned by the layer-stack singleton
(`$lib/state/layer-stack.svelte.ts`): every dismissible layer registers on open;
hand-rolled Escape/outside-click handlers guard with `wasTop(id)` — the top layer
snapshotted at window-capture time, because Bits UI dismisses a covering layer
synchronously before bubble handlers run (`isTop` would lie and double-close) — so one
keypress peels exactly one layer. Never register tooltips, toasts, the consent banner, or
the desktop chatbot dock.

```typescript

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

/** Border radius tokens (CSS variable refs, set by data-radius attribute) */
export const borderRadius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  full: 'var(--radius-full)',
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
import transformerDirectives from '@unocss/transformer-directives';
import { defineConfig, presetIcons, presetUno } from 'unocss';
import {
  borderRadius, breakpoints, colors, containers,
  fontFamily, fontSize, iconSize, spacing, zIndex,
} from './src/lib/styles/tokens';

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({ collections: { lucide: /* lazy import */ }, scale: 1.2 }),
  ],
  transformers: [transformerDirectives()],

  theme: {
    breakpoints,
    containers,
    fontSize: { ...fontSize, ...iconSize }, // icon-* sizes become text-icon-* utilities
    spacing,
    fontFamily,
    colors,
    borderRadius,
    zIndex,
    // Duration requires custom rule or CSS variables
  },

  // Custom rules for duration utilities
  rules: [
    ['duration-fast', { 'transition-duration': 'var(--duration-fast, 150ms)' }],
    // ...instant / normal / slow / slower
  ],

  // Decorative background utilities
  shortcuts: {
    'bg-dots': 'bg-[radial-gradient(...)] bg-[length:20px_20px]',
    'bg-grid': 'bg-[linear-gradient(...)] bg-[length:30px_30px]',
  },

  // Safelist commonly used dynamic classes (text-*, spacing, and i-lucide-* icons)
  safelist: [
    ...Object.keys(fontSize).map(k => `text-${k}`),
    ...Object.keys(iconSize).map(k => `text-${k}`),
    ...Object.keys(spacing).flatMap(k => [`p-${k}`, `m-${k}`, `gap-${k}`]),
    // plus the full list of dynamically-rendered i-lucide-* icon classes
  ],
});
```

---

## CSS Custom Properties

Global CSS variables defined in `app.css`. All colors are **OKLCH**, not hex. Values below are illustrative — see `app.css` for the full set (accent, secondary, info, surfaces, chart series, etc.):

```css
/* src/app.css */

:root {
  /* Colors - Light mode (OKLCH: lightness chroma hue) */
  --color-bg: oklch(0.88 0.015 240);
  --color-fg: oklch(0.35 0.06 210);
  --color-muted: oklch(0.45 0.02 260);
  --color-border: oklch(1 0 0);
  --color-primary: oklch(0.42 0.27 290);
  --color-primary-hover: oklch(0.52 0.16 60); /* warm gold, not a blue */
  --color-success: oklch(0.55 0.16 150);
  --color-warning: oklch(0.6 0.16 70);
  --color-error: oklch(0.53 0.21 25);

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
  --color-bg: oklch(0.17 0.01 250);
  --color-fg: oklch(0.78 0.1 175);
  --color-muted: oklch(0.78 0.015 240);
  --color-border: oklch(0.32 0.015 250);
  --color-primary: oklch(0.58 0.24 290);
  --color-primary-hover: oklch(0.93 0.1 95);
  --color-success: oklch(0.62 0.17 150);
  --color-warning: oklch(0.8 0.15 85);
  --color-error: oklch(0.6 0.2 25);
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
- [app-shell/](../app-shell/README.md) - Sidebar dimensions and z-index usage
- [state.md](../state.md) - Theme state management

---

## Sources

- [UnoCSS Theme Config](https://unocss.dev/config/theme)
- [Fluid Type Scale Calculator](https://www.fluid-type-scale.com/)
- [Design Tokens W3C Draft](https://design-tokens.github.io/community-group/format/)
- [WCAG 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
