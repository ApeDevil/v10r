# Component Architecture

Accessible, composable UI components built on Bits UI primitives with CVA styling.

This doc explains the **system** — the layers, the rules, how components meet design tokens. It is not a per-component prop catalog; props live in source under `src/lib/components/`. Read the component file for current props.

---

## Layer System

Components are organized in layers. Lower layers are dumber and more reusable; higher layers carry app context.

| Layer | Directory | Purpose | Examples |
|-------|-----------|---------|----------|
| **Bits UI** | (dependency) | Headless, accessible primitives | `Dialog.Root`, `Select.Trigger` |
| **primitives** | `primitives/` | Styled atomic components | Button, Input, Badge, Select, Switch, Table |
| **composites** | `composites/` | Composed from primitives | Card, FormField, CommandPalette, Chatbot, Dock |
| **layout** | `layout/` | Structural wrappers | Stack, Cluster, PageContainer |
| **shell** | `shell/` | App shell / navigation | AppShell, Sidebar, NavItem, UserMenu |
| **branding** | `branding/` | Logos, palette editor | LogoHero, LogoFooter, CustomPaletteEditor |
| **ui** | `ui/` | Specialized inputs | OklchColorInput, ContrastBadge |
| **viz** | `viz/` | Data visualization | charts, graphs, ERD, sankey |

Feature surfaces also have their own component folders: `chat/`, `explorer/`, `spreadsheet/`, `editor/`, `cycle/`, `preview/`, `transparency/`, `blog/`, `3d/`.

```
Bits UI (headless)
    ↓ wrap with CVA styles
primitives (styled atoms)
    ↓ compose
composites (molecules / organisms)
    ↓ use in
pages
```

- **Bits UI** handles accessibility, keyboard nav, ARIA.
- **primitives** add consistent styling via CVA + UnoCSS + design tokens.
- **composites** add business logic, layout, feature behavior.

### Barrel Exports

```typescript
// src/lib/components/index.ts
export * from './composites';
export * from './layout';
export * from './primitives';
// viz/ and shell/ are intentionally excluded from the default barrel.
```

`viz/` is excluded so Chart.js / Three.js don't enter the default bundle — import from `$lib/components/viz` directly. `shell/` is excluded because it's app-specific — import from `$lib/components/shell`. The same applies to `3d/`.

```svelte
<script>
  import { Button, Input, Card, FormField } from '$lib/components';
  import { Chart } from '$lib/components/viz';
  import { AppShell } from '$lib/components/shell';
</script>
```

---

## Component-First Rule

**Never use a raw HTML element when a project component exists.** Raw `<input>`, `<button>`, `<select>`, `<textarea>` bypass the design system and break visual consistency. Check every layer for an existing component before reaching for a raw element.

### Exceptions

| Raw element allowed | Reason |
|---------------------|--------|
| `<input type="hidden">` | Form data, no styling |
| `<input type="checkbox">` inside table rows | Native indeterminate support |
| `<select>` binding a numeric value | Select component only binds strings |
| Custom interactive regions (palette cards, sort headers) | Need specialized styling |

---

## How Components Meet Design Tokens

Styling flows through **CVA → UnoCSS utilities → token-backed CSS variables**. Components never hardcode colors or spacing; every value resolves to a token defined in `app.css` (see [tokens.md](./tokens.md)).

### CVA Variant Pattern

Variants are defined in a sibling `.ts` file, typed, and merged onto the element with `cn` (a `clsx` wrapper in `$lib/utils/cn.ts`).

```typescript
// src/lib/components/primitives/button/button.ts
import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  ['inline-flex items-center justify-center rounded-md font-medium',
   'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
   'disabled:pointer-events-none disabled:opacity-50'],
  {
    variants: {
      intent: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'bg-transparent border border-border text-fg',
        ghost: 'bg-transparent text-fg',
        destructive: 'bg-error text-white',
      },
      size: { sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-12 px-6', icon: 'h-10 w-10' },
    },
    defaultVariants: { intent: 'primary', size: 'md' },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
```

```svelte
<!-- Button.svelte (shape) -->
<script lang="ts">
import { buttonVariants, type ButtonVariants } from './button.ts';
import { cn } from '$lib/utils/cn';
// props extend HTMLButtonAttributes & ButtonVariants
</script>

<button class={cn(buttonVariants({ intent, size }), className)} {...restProps}>
  {@render children()}
</button>
```

> **Tokens that UnoCSS can't extract** (opacity modifiers on CSS-variable colors like `bg-muted/10`, variant colors, nested color keys) are handled with scoped CSS using `color-mix()` or `var(--color-*)` directly. See `Button.svelte` and `Input.svelte` for the pattern, and the project memory notes on UnoCSS extraction limits.

### Composition Pattern

Composites assemble primitives and pass content via snippets. Canonical example:

```svelte
<!-- composites/card/Card.svelte (shape) -->
<article class={cn('rounded-lg border border-border bg-bg shadow-sm', className)}>
  {#if header}<header class="border-b border-border px-fluid-4 py-fluid-3">{@render header()}</header>{/if}
  {#if children}<div class="px-fluid-4 py-fluid-4">{@render children()}</div>{/if}
  {#if footer}<footer class="border-t border-border px-fluid-4 py-fluid-3">{@render footer()}</footer>{/if}
</article>
```

```svelte
<Card>
  {#snippet header()}<h3 class="text-fluid-lg font-semibold">Title</h3>{/snippet}
  <p>Content.</p>
  {#snippet footer()}<Button size="sm">Action</Button>{/snippet}
</Card>
```

---

## Conventions

Every component in the system follows these. Match them when adding one.

- **Folder per component.** `name/Name.svelte` + `name.ts` (CVA, if variant-driven) + `index.ts` barrel.
- **Props via `$props()` with a typed `Props` interface.** Extend the matching `HTML*Attributes` for native pass-through; spread `...restProps` onto the root element.
- **Bindable state via `$bindable()`** for two-way props (`open`, `value`).
- **Content via snippets** (`children`, named snippets), rendered with `{@render}`.
- **Events lowercase** (`onclick`, `oninput`, `onchange`), forwarded as props.
- **`class` prop merged last** through `cn(...)` so callers can override.
- **No hardcoded colors or spacing** — token-backed utilities only.

### Icons

Pure-CSS icons via UnoCSS `presetIcons`. Lucide is the only registered set. Render an `i-lucide-*` class on a `<span>`; size with the `text-icon-*` tokens.

```svelte
<span class="i-lucide-home text-icon-md"></span>
```

Icons used dynamically (from data structures or string props) must be safelisted in `uno.config.ts`, since UnoCSS cannot extract them at build time.

---

## Accessibility

| Requirement | How |
|-------------|-----|
| Keyboard navigation | Bits UI primitives |
| Focus management | Automatic focus trap in modals (Bits UI) |
| ARIA | Bits UI provides correct roles/attributes |
| Reduced motion | Respect `prefers-reduced-motion` |

All interactive primitives carry a visible focus ring:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
```

Icon-only controls need screen-reader text:

```svelte
<button>
  <span class="i-lucide-x text-icon-sm"></span>
  <span class="sr-only">Close dialog</span>
</button>
```

---

## Finding a Component

The live inventory is the source tree, not this doc.

- **Browse** `src/lib/components/<layer>/` — each folder is one component.
- **Read** the component's `.svelte` (props) and `.ts` (variants).
- **Live gallery:** `/showcases/ui` renders the components with controls (see [pages.md](../pages.md)).

---

## Showcase Catalog Coverage

A working showcase proves a feature. But "proven by use" and "found in the catalog" are different guarantees: a barrel export with no catalog entry is invisible to the gallery — and to the search/chatbot index built from it — even when it runs on every page.

**Rule: barrel membership ⇒ catalog entry.** Anything exported from `$lib/components` is a copyable contract and earns an entry under `/showcases/ui/*` — a `DemoCard` carrying a live demo plus a `ComponentDoc` (props + notes).

### Meta-chrome exception

Some composites **are** the showcase's own chrome — `NavSection`, `PageHeader`, `ShowcaseLayout`, `NavTab`. Mounting one inside a demo card re-instantiates the page's own frame: duplicate scroll observers, colliding `<nav>` landmarks, a second sticky context, or the PageHeader singleton-context hang. **Document meta-chrome by contract: keep the `ComponentDoc`, swap the live demo for a static facsimile, and point to the real instance already on the page. Never mount a second live copy.** `NavSection` is the worked example (`_sections/NavigationSection.svelte`).

**Triage test:** does the component couple to **window scroll**, a **document-global lookup** (`getElementById`), a **singleton context**, or a **colliding landmark**? Yes → document by contract — unless that behavior goes dormant inside the static demo box. Only chrome that actively fights the page needs the facsimile. `PageHeader` is the contrast: it is chrome, but its scroll-coupling sleeps in a non-scrolling box and it manages its own margins, so it live-demos safely (the `chrome={false}` prop is the escape hatch for the singleton clash). No → ordinary live demo.

### Audit status

The composites catalog has drifted from the barrel: ~30 composites exported, only a handful rendered in the `composites/` index (others live in sibling routes like `menus/`, `tables/`, `splits/`). Reconcile catalog ↔ barrel as a follow-up, applying the triage above.

| Candidate | Verdict | Status |
|-----------|---------|--------|
| `NavSection` | Meta-chrome (scroll, sticky context, `<nav>`) | Documented by contract ✅ |
| `PageHeader` | Chrome, but scroll-coupling stays dormant in a static demo box | Live demo ✅ (`chrome={false}` escape hatch) |
| `ShowcaseLayout` | Meta-chrome (nests PageHeader + NavTab) | Pending |
| `NavTab` | Meta-chrome (sticky, landmark) | Pending |
| `NavGrid` | Benign (`<nav>` grid wrapper) | Live demo |
| `Dock`, `DiagGrid` | Triage pending | Pending |

---

## Summary

| What | How |
|------|-----|
| Base library | Bits UI (headless) |
| Styling | CVA + UnoCSS + token CSS variables |
| Layers | primitives → composites → layout → shell → branding → ui → viz |
| Default rule | Component-First — no raw elements when a component exists |
| Icons | UnoCSS presetIcons (`i-lucide-*` classes) |
| Props | `$props()` with typed interface, `$bindable()` |
| Slots | Snippets (`{#snippet}` / `{@render}`) |
| Events | lowercase (`onclick`) |

---

## Related

- [README.md](./README.md) - Design philosophy and component rules
- [tokens.md](./tokens.md) - Design tokens (colors, spacing, z-index)
- [styling.md](./styling.md) - UnoCSS configuration, fluid scales
- [forms.md](../forms.md) - Form patterns using these components
- [app-shell/](../app-shell/README.md) - Shell components (Sidebar, NavItem, etc.)
- [ai/README.md](../ai/README.md) - Chatbot implementation and provider configuration
- [pages.md](../pages.md) - `/showcases/ui` component gallery

---

## Sources

- [Bits UI Documentation](https://bits-ui.com/)
- [CVA Documentation](https://cva.style/docs)
- [UnoCSS presetIcons](https://unocss.dev/presets/icons)
- [Svelte 5 Snippets](https://svelte.dev/docs/svelte/snippet)
