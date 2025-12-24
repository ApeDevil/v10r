# Design System

The strategic foundation for Velociraptor's visual language.

---

## Design Philosophy

Five principles that guide every design decision:

### 1. Clarity Over Cleverness

Obvious beats innovative. Users should understand interfaces instantly, not admire them.

```
Bad:  Icon-only navigation with hover tooltips
Good: Labeled navigation with icons as enhancement
```

### 2. Content First

UI serves content, not the reverse. Reduce visual noise. Let information breathe.

```
Bad:  Decorative borders, shadows everywhere, busy backgrounds
Good: Whitespace, subtle dividers, content as the hero
```

### 3. Progressive Disclosure

Show what's needed now. Reveal complexity on demand.

```
Bad:  All options visible at once
Good: Primary actions visible, secondary in menus/dropdowns
```

### 4. Responsive by Default

Every component works on every screen. No "desktop-only" features.

```
Bad:  Horizontal data tables that break on mobile
Good: Cards that stack, tables that scroll or transform
```

### 5. Accessible Always

Accessibility isn't a feature—it's a baseline. WCAG 2.1 AA minimum.

```
Bad:  "We'll add accessibility later"
Good: Contrast, focus states, and keyboard nav from day one
```

---

## Visual Identity

### Personality Traits

| Trait | Expression |
|-------|------------|
| **Professional** | Clean lines, restrained color, consistent spacing |
| **Approachable** | Rounded corners, friendly typography, helpful microcopy |
| **Modern** | Flat design, subtle shadows, contemporary type scale |
| **Efficient** | Dense when needed, spacious when possible, no decoration |

### Aesthetic Direction

```
Minimalist ████████░░ Decorative
Serious    ███████░░░ Playful
Dense      ████░░░░░░ Spacious
Sharp      ███░░░░░░░ Rounded
```

We lean minimal, serious, and spacious—but not extreme. Corners are softened (`rounded-lg`), not pill-shaped. Colors are muted, not gray.

### Typography Character

- **Headings**: Bold, tight letter-spacing, clear hierarchy
- **Body**: Comfortable reading measure (45-75 characters)
- **UI**: Slightly smaller, medium weight, functional
- **Code**: Monospace, distinct from prose

---

## Theming Architecture

Three-tier token system enables flexibility without chaos:

```
┌─────────────────────────────────────────────────────────┐
│  PRIMITIVES (Raw Values)                                │
│  blue-500: #3b82f6                                      │
│  spacing-4: 1rem                                        │
│  font-sans: 'Inter', system-ui                          │
└────────────────────────┬────────────────────────────────┘
                         │ referenced by
                         ▼
┌─────────────────────────────────────────────────────────┐
│  SEMANTIC TOKENS (Meaning)                              │
│  --color-primary: var(--blue-500)                       │
│  --color-bg: var(--neutral-50)                          │
│  --spacing-section: var(--spacing-7)                    │
└────────────────────────┬────────────────────────────────┘
                         │ consumed by
                         ▼
┌─────────────────────────────────────────────────────────┐
│  COMPONENT TOKENS (Specific)                            │
│  --button-bg: var(--color-primary)                      │
│  --card-padding: var(--spacing-4)                       │
│  --input-border: var(--color-border)                    │
└─────────────────────────────────────────────────────────┘
```

### Why This Matters

| Change Level | Scope | Example |
|--------------|-------|---------|
| **Primitive** | Everything using that value | Change `blue-500` = all blues shift |
| **Semantic** | All uses of that meaning | Change `--color-primary` = all primary elements |
| **Component** | Single component | Change `--button-bg` = only buttons |

**Rule**: Components consume semantic tokens, not primitives. This enables theming.

---

## Customization Points

What users CAN easily change (designed for flexibility):

| Category | Customizable | How |
|----------|--------------|-----|
| **Brand Colors** | Primary, success, warning, error | CSS variables in `app.css` |
| **Dark Mode** | Full palette swap | `.dark` class on `<html>` |
| **Typography** | Font family, fluid scale | Theme config + CSS variables |
| **Spacing** | Fluid scale multipliers | Theme config |
| **Border Radius** | Global roundness | Single CSS variable |
| **Shadows** | Elevation scale | CSS variables |

What's intentionally FIXED (for coherence):

| Category | Fixed | Why |
|----------|-------|-----|
| **Breakpoints** | 640/768/1024/1280/1536 | Content-based, well-tested |
| **Z-index scale** | Defined layers | Prevents z-index wars |
| **Focus states** | Ring style + offset | Accessibility consistency |
| **Transition timing** | Easing functions | Motion coherence |

### Quick Theme Override

```css
/* app.css - Brand customization */
:root {
  /* Change these to rebrand */
  --color-primary: #your-brand-color;
  --color-primary-hover: #your-hover-color;
  --radius-default: 0.5rem; /* or 0 for sharp, 9999px for pills */
  --font-sans: 'Your Font', system-ui;
}
```

---

## Accessibility Baseline

### Target: WCAG 2.1 AA

| Requirement | Implementation |
|-------------|----------------|
| **Color Contrast** | 4.5:1 text, 3:1 UI elements |
| **Focus Visible** | 2px ring, offset, high contrast |
| **Keyboard Navigation** | All interactive elements reachable |
| **Screen Reader** | Semantic HTML, ARIA where needed |
| **Motion** | Respect `prefers-reduced-motion` |
| **Text Sizing** | Works at 200% zoom |

### Non-Negotiables

1. **Never rely on color alone** - Use icons, patterns, or text
2. **Focus must be visible** - No `outline: none` without replacement
3. **Touch targets** - Minimum 44x44px on mobile
4. **Skip links** - Present on every page
5. **Form labels** - Every input has one (visible or sr-only)

### Implementation

```svelte
<!-- Focus ring utility (built into components) -->
<button class="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">

<!-- Reduced motion -->
<div class="motion-safe:transition-all motion-reduce:transition-none">

<!-- Skip link -->
<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>
```

---

## Motion Language

### Personality: Quick & Subtle

Animations feel responsive, not showy. Users shouldn't wait for animations.

| Trait | Value |
|-------|-------|
| **Speed** | Fast (150-250ms typical) |
| **Easing** | Ease-out for entrances, ease-in for exits |
| **Distance** | Short movements (8-24px) |
| **Frequency** | Sparse—only when meaningful |

### When to Animate

| Use Animation | Skip Animation |
|---------------|----------------|
| State changes (open/close) | Static content |
| Feedback (success/error) | Text appearance |
| Spatial transitions (modals, drawers) | Every hover state |
| Loading states | Decorative flourishes |

### Duration Scale

```css
--duration-instant: 0ms;      /* Immediate feedback */
--duration-fast: 150ms;       /* Micro-interactions */
--duration-normal: 250ms;     /* Standard transitions */
--duration-slow: 400ms;       /* Complex animations */
--duration-slower: 600ms;     /* Page transitions (rare) */
```

### Easing

```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);  /* Smooth default */
--ease-in: cubic-bezier(0.4, 0, 1, 1);          /* Accelerate out */
--ease-out: cubic-bezier(0, 0, 0.2, 1);         /* Decelerate in */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Playful (rare) */
```

### Reduced Motion

Always respect user preference:

```svelte
<script>
  import { fly } from 'svelte/transition';

  const prefersReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

{#if visible}
  <div transition:fly={{ y: prefersReducedMotion ? 0 : 20, duration: 200 }}>
    Content
  </div>
{/if}
```

---

## Design Decisions Log

Key choices and their rationale:

### UnoCSS over Tailwind

| Factor | Decision |
|--------|----------|
| **Choice** | UnoCSS with `preset-uno` |
| **Why** | Faster build, on-demand generation, better DX with attributify |
| **Trade-off** | Smaller ecosystem, less documentation |
| **Reversibility** | High—class names are Tailwind-compatible |

### Fluid Typography over Breakpoints

| Factor | Decision |
|--------|----------|
| **Choice** | `clamp()` with `rem + vw` |
| **Why** | Smooth scaling, fewer media queries, respects zoom |
| **Trade-off** | Harder to calculate, less precise control |
| **Reversibility** | Medium—would require touching all text utilities |

### CSS Variables over Tailwind Theme

| Factor | Decision |
|--------|----------|
| **Choice** | CSS custom properties for colors |
| **Why** | Runtime theming, dark mode without rebuilding |
| **Trade-off** | Slightly more CSS, less Tailwind tooling |
| **Reversibility** | Low—core to theming strategy |

### Container Queries for Components

| Factor | Decision |
|--------|----------|
| **Choice** | `@container` over media queries for components |
| **Why** | Components adapt to context, not viewport |
| **Trade-off** | Newer API (but well-supported in 2024+) |
| **Reversibility** | Medium—component-level change |

### Bits UI over Radix/Headless

| Factor | Decision |
|--------|----------|
| **Choice** | Bits UI primitives |
| **Why** | Svelte-native, unstyled, accessible by default |
| **Trade-off** | Smaller community than React alternatives |
| **Reversibility** | Low—component architecture depends on it |

### CVA for Variants

| Factor | Decision |
|--------|----------|
| **Choice** | Class Variance Authority |
| **Why** | Type-safe variants, clean API, works with any CSS |
| **Trade-off** | Extra dependency, learning curve |
| **Reversibility** | Medium—variants are centralized |

---

## Color Philosophy

### Light Mode First

Design in light mode, adapt to dark. Not the reverse.

### Semantic Over Literal

Name colors by purpose, not appearance:

```css
/* Bad - literal */
--blue-button: #3b82f6;
--light-gray-bg: #f8fafc;

/* Good - semantic */
--color-primary: #3b82f6;
--color-bg: #f8fafc;
```

### Minimal Palette

Resist adding colors. Every new color needs justification:

| Category | Count | Purpose |
|----------|-------|---------|
| **Neutral** | 1 scale | Backgrounds, text, borders |
| **Primary** | 1 color + hover | Brand, primary actions |
| **Feedback** | 3 colors | Success, warning, error |

That's it. If you need more, question why.

---

## Component Design Rules

### 1. Composition Over Configuration

Build from small pieces. Don't make mega-components with 20 props.

```svelte
<!-- Bad: Monolithic -->
<Card
  title="Hello"
  subtitle="World"
  image="/img.jpg"
  actions={[...]}
  variant="horizontal"
/>

<!-- Good: Composable -->
<Card>
  <Card.Image src="/img.jpg" />
  <Card.Content>
    <Card.Title>Hello</Card.Title>
    <Card.Subtitle>World</Card.Subtitle>
  </Card.Content>
  <Card.Actions>...</Card.Actions>
</Card>
```

### 2. Variants via CVA

All visual variations defined in one place:

```typescript
const button = cva('base-classes', {
  variants: {
    intent: { primary: '...', secondary: '...', ghost: '...' },
    size: { sm: '...', md: '...', lg: '...' }
  },
  defaultVariants: { intent: 'primary', size: 'md' }
});
```

### 3. Slots Over Children When Typed

Use Svelte 5 snippets for complex composition:

```svelte
<Dialog>
  {#snippet trigger()}<Button>Open</Button>{/snippet}
  {#snippet content()}<p>Dialog content</p>{/snippet}
</Dialog>
```

### 4. Escape Hatch via `class`

Every component accepts `class` for overrides:

```svelte
<Button class="w-full">Full Width</Button>
```

---

## File Structure

```
src/
├── app.css                    # CSS variables, global styles
├── lib/
│   └── styles/
│       └── tokens.ts          # Exported token values for UnoCSS
├── uno.config.ts              # UnoCSS theme configuration
│
docs/blueprint/
├── design.md                  # This file - philosophy & strategy
├── tokens.md                  # Token values & scales
├── styling.md                 # Implementation techniques
└── components.md              # Component patterns
```

---

## Related

- [tokens.md](./tokens.md) - Concrete token values and scales
- [styling.md](./styling.md) - UnoCSS, fluid techniques, container queries
- [components.md](./components.md) - Component architecture and patterns
- [app-shell.md](../app-shell.md) - Layout structure and navigation

---

## Sources

- [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [Tokens in Design Systems - EightShapes](https://medium.com/eightshapes-llc/tokens-in-design-systems-25dd82d58421)
- [Design Tokens - Material Design 3](https://m3.material.io/foundations/design-tokens/overview)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
