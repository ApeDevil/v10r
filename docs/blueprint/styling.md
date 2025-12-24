# Styling Architecture

Mobile-first fluid responsive design with UnoCSS.

---

## Strategy

**Fluid Responsive Design** - not pure adaptive, not pure fluid.

| Layer | Technique | Purpose |
|-------|-----------|---------|
| Typography | `clamp()` | Smooth text scaling |
| Spacing | `clamp()` | Proportional gaps |
| Page layout | Media queries | Structural changes |
| Components | Container queries | Self-contained responsiveness |

---

## Mobile-First Approach

Design for smallest viewport first, then enhance for larger screens.

```css
/* Base styles = mobile */
.card { padding: 1rem; }

/* Enhanced for larger screens */
@media (min-width: 768px) {
  .card { padding: 2rem; }
}
```

In UnoCSS:
```svelte
<div class="p-4 md:p-8">
```

Unprefixed = mobile. Prefixed (`md:`, `lg:`) = larger screens.

---

## Fluid Typography

Use `clamp(min, preferred, max)` for smooth scaling.

### Accessibility Requirement

**Always combine `vw` with `rem`** in the preferred value. Pure `vw` doesn't respond to browser zoom, failing WCAG 1.4.4.

```css
/* Bad - doesn't zoom */
font-size: clamp(1rem, 4vw, 2rem);

/* Good - zooms correctly */
font-size: clamp(1rem, 0.5rem + 2vw, 2rem);
```

### Scale

| Name | Value | Use |
|------|-------|-----|
| `fluid-xs` | `clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)` | Captions, labels |
| `fluid-sm` | `clamp(0.875rem, 0.8rem + 0.25vw, 1rem)` | Small text |
| `fluid-base` | `clamp(1rem, 0.9rem + 0.5vw, 1.125rem)` | Body text |
| `fluid-lg` | `clamp(1.125rem, 1rem + 0.5vw, 1.25rem)` | Lead text |
| `fluid-xl` | `clamp(1.25rem, 1rem + 1vw, 1.5rem)` | H4 |
| `fluid-2xl` | `clamp(1.5rem, 1.2rem + 1.5vw, 2rem)` | H3 |
| `fluid-3xl` | `clamp(1.875rem, 1.5rem + 2vw, 2.5rem)` | H2 |
| `fluid-4xl` | `clamp(2.25rem, 1.5rem + 3vw, 3.5rem)` | H1 |
| `fluid-5xl` | `clamp(3rem, 2rem + 4vw, 5rem)` | Display |

Use [Fluid Type Scale Calculator](https://www.fluid-type-scale.com/) for precise values.

### UnoCSS Config

```ts
// uno.config.ts
export default defineConfig({
  theme: {
    fontSize: {
      'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
      'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.25vw, 1rem)',
      'fluid-base': 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)',
      'fluid-lg': 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)',
      'fluid-xl': 'clamp(1.25rem, 1rem + 1vw, 1.5rem)',
      'fluid-2xl': 'clamp(1.5rem, 1.2rem + 1.5vw, 2rem)',
      'fluid-3xl': 'clamp(1.875rem, 1.5rem + 2vw, 2.5rem)',
      'fluid-4xl': 'clamp(2.25rem, 1.5rem + 3vw, 3.5rem)',
      'fluid-5xl': 'clamp(3rem, 2rem + 4vw, 5rem)',
    }
  }
})
```

### Usage

```svelte
<h1 class="text-fluid-4xl">Page Title</h1>
<p class="text-fluid-base">Body text that scales smoothly.</p>
```

Or with arbitrary values:
```svelte
<h1 class="text-[clamp(2rem,5vw,4rem)]">Custom Scale</h1>
```

---

## Fluid Spacing

Same principle for margins, padding, and gaps.

### Scale

| Name | Value | Use |
|------|-------|-----|
| `fluid-1` | `clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)` | Tight |
| `fluid-2` | `clamp(0.5rem, 0.4rem + 0.5vw, 1rem)` | Small |
| `fluid-3` | `clamp(0.75rem, 0.5rem + 1vw, 1.5rem)` | Medium |
| `fluid-4` | `clamp(1rem, 0.75rem + 1.5vw, 2rem)` | Default |
| `fluid-5` | `clamp(1.5rem, 1rem + 2vw, 3rem)` | Large |
| `fluid-6` | `clamp(2rem, 1.5rem + 2.5vw, 4rem)` | XL |
| `fluid-7` | `clamp(3rem, 2rem + 4vw, 6rem)` | Section |
| `fluid-8` | `clamp(4rem, 3rem + 5vw, 8rem)` | Hero |

### UnoCSS Config

```ts
// uno.config.ts
export default defineConfig({
  theme: {
    spacing: {
      'fluid-1': 'clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)',
      'fluid-2': 'clamp(0.5rem, 0.4rem + 0.5vw, 1rem)',
      'fluid-3': 'clamp(0.75rem, 0.5rem + 1vw, 1.5rem)',
      'fluid-4': 'clamp(1rem, 0.75rem + 1.5vw, 2rem)',
      'fluid-5': 'clamp(1.5rem, 1rem + 2vw, 3rem)',
      'fluid-6': 'clamp(2rem, 1.5rem + 2.5vw, 4rem)',
      'fluid-7': 'clamp(3rem, 2rem + 4vw, 6rem)',
      'fluid-8': 'clamp(4rem, 3rem + 5vw, 8rem)',
    }
  }
})
```

### Usage

```svelte
<section class="py-fluid-7">
  <div class="space-y-fluid-4">
    <h2 class="mb-fluid-3">Section Title</h2>
    <p>Content with fluid spacing.</p>
  </div>
</section>
```

---

## Breakpoints

Content-driven, not device-driven. These are starting points:

| Name | Width | Use |
|------|-------|-----|
| `sm` | 640px | Large phones landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### UnoCSS Usage

```svelte
<!-- Stack on mobile, 2 cols on tablet, 3 on desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-fluid-4">
  <Card />
  <Card />
  <Card />
</div>
```

### When to Use Breakpoints

Use for **structural changes** only:
- Navigation collapse/expand
- Sidebar show/hide
- Grid column changes
- Layout direction changes

Don't use for:
- Font sizes (use fluid)
- Spacing (use fluid)
- Component internals (use container queries)

---

## Container Queries

Components adapt to their container, not the viewport.

Built into `preset-mini` and `preset-uno` - no extra preset needed.

### Setup

```svelte
<!-- Parent defines the container -->
<div class="@container">
  <Card />
</div>
```

### Component Responds to Container

```svelte
<!-- Card.svelte -->
<article class="flex flex-col @md:flex-row gap-fluid-3">
  <img class="w-full @md:w-1/3" src={image} alt="" />
  <div class="flex-1">
    <h3>{title}</h3>
    <p class="hidden @lg:block">{description}</p>
  </div>
</article>
```

### Custom Container Sizes (Optional)

```ts
// uno.config.ts
export default defineConfig({
  theme: {
    containers: {
      xs: '320px',
      sm: '384px',
      md: '448px',
      lg: '512px',
      xl: '576px',
    }
  }
})
```

### Named Containers

For nested contexts:

```svelte
<div class="@container/sidebar">
  <div class="@container/card">
    <div class="@md/card:flex-row @lg/sidebar:hidden">
      <!-- Responds to specific containers -->
    </div>
  </div>
</div>
```

### Key Rule

> A container cannot query itself. The `@container` must be on an ancestor.

---

## Color System

CSS custom properties for theming. All color values are defined in [tokens.md](./tokens.md).

### Design Tokens

See [tokens.md → Color Values](./tokens.md#colors) for the complete color palette with WCAG contrast ratios.

The tokens define:
- **Semantic colors:** `bg`, `fg`, `muted`, `border`
- **Brand colors:** `primary`, `primary-hover`
- **Feedback colors:** `success`, `warning`, `error`
- **Dark mode variants:** Automatic via `.dark` class

### UnoCSS Integration

```ts
// uno.config.ts
export default defineConfig({
  theme: {
    colors: {
      bg: 'var(--color-bg)',
      fg: 'var(--color-fg)',
      muted: 'var(--color-muted)',
      border: 'var(--color-border)',
      primary: {
        DEFAULT: 'var(--color-primary)',
        hover: 'var(--color-primary-hover)',
      },
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      error: 'var(--color-error)',
    }
  }
})
```

### Usage

```svelte
<div class="bg-bg text-fg border-border">
  <button class="bg-primary hover:bg-primary-hover">
    Action
  </button>
</div>
```

---

## Component Patterns

### Card

```svelte
<article class="bg-bg border border-border rounded-lg p-fluid-4 @container">
  <div class="flex flex-col @sm:flex-row gap-fluid-3">
    <img
      class="w-full @sm:w-32 aspect-square object-cover rounded"
      src={image}
      alt=""
    />
    <div class="flex-1 space-y-fluid-2">
      <h3 class="text-fluid-lg font-semibold">{title}</h3>
      <p class="text-muted text-fluid-sm line-clamp-2">{description}</p>
    </div>
  </div>
</article>
```

### Section

```svelte
<section class="py-fluid-7">
  <div class="max-w-7xl mx-auto px-fluid-4">
    <h2 class="text-fluid-3xl font-bold mb-fluid-5">{title}</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-fluid-4">
      <slot />
    </div>
  </div>
</section>
```

### Button

```svelte
<button
  class="
    px-fluid-3 py-fluid-2
    text-fluid-sm font-medium
    bg-primary text-white
    hover:bg-primary-hover
    rounded-lg
    transition-colors
  "
>
  <slot />
</button>
```

---

## File Structure

```
src/
├── app.css                    # Global styles, CSS variables
├── lib/
│   ├── components/
│   │   ├── ui/               # Base components
│   │   │   ├── Button.svelte
│   │   │   ├── Card.svelte
│   │   │   └── Input.svelte
│   │   └── layout/           # Layout components
│   │       ├── Section.svelte
│   │       └── Container.svelte
│   └── styles/
│       └── tokens.css        # Design tokens (if separate)
└── uno.config.ts             # UnoCSS configuration
```

---

## Summary

| What | How |
|------|-----|
| Text sizing | Fluid `clamp()` scale |
| Spacing | Fluid `clamp()` scale |
| Page structure | Media query breakpoints |
| Component layout | Container queries (built into preset-uno) |
| Colors | CSS variables + theme |
| Dark mode | `.dark` class on `<html>` |

This approach gives smooth scaling, component portability, and minimal CSS.

---

## Related

- [tokens.md](./tokens.md) - Single source of truth for all design values
- [pages.md](./pages.md) - Routes using these styling patterns, especially `/showcase/theme` and `/showcase/ui`
- [state.md](./state.md) - Theme state management with `$state` and localStorage

---

## Sources

- [UnoCSS Theme Config](https://unocss.dev/config/theme)
- [UnoCSS Mini Preset (dark mode, container queries)](https://unocss.dev/presets/mini)
- [Smashing Magazine - Modern Fluid Typography](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/)
- [Fluid Type Scale Calculator](https://www.fluid-type-scale.com/)
- [CSS Container Queries - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries)
