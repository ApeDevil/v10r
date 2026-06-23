# UnoCSS

On-demand atomic CSS engine — the styling layer, paired with Bits UI. Config lives in `uno.config.ts`; design tokens in `src/app.css`. See the `unocss` skill for utility syntax and the project's extraction gotchas.

## Why was it chosen?

- Tailwind-compatible utilities via `preset-wind`, plus pure-CSS icons via `preset-icons` (see [Icons](#icons)).
- Note: custom spacing in `tokens.ts` **replaces** UnoCSS defaults — keys 1-8 differ from Tailwind. Use arbitrary values for precise sizing.

## Accessibility Requirements

UnoCSS should be configured to meet WCAG 2.1 AA baseline (with AAA targets for touch):

| Requirement | Implementation | WCAG Level |
|-------------|----------------|------------|
| **Focus visible** | `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` | AA (1.4.11) |
| **Reduced motion** | `motion-safe:transition motion-reduce:transition-none` | AAA (2.3.3) |
| **Touch targets** | 24×24px minimum (AA), 44×44px recommended (AAA) | AA/AAA |
| **Color contrast** | Use semantic tokens with 4.5:1 minimum ratio | AA (1.4.3) |
| **Screen reader** | `sr-only` utility for visually hidden text | A (1.3.1) |

**Key utility patterns:**
- Focus: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` on all interactive elements
- Motion: `motion-safe:transition-all motion-reduce:transition-none` for animation respect
- Screen reader: `sr-only` for visually hidden but accessible text

See [design/tokens.md](../../blueprint/design/tokens.md) for WCAG-compliant color tokens.

## Dark Mode

Class-based dark mode via `preset-wind`. Toggle `.dark` on `<html>` to switch themes. Prefix any utility with `dark:` for theme-aware styling (e.g., `dark:bg-gray-900`).

See [shell-state.md](../../blueprint/app-shell/shell-state.md#theme-state) for SSR-safe theme state management with cookie persistence.

## Icons

`presetIcons` generates CSS rules (mask-image with SVG data URIs) for classes like `i-lucide-database`. CSS is generated at **build time** via static extraction — UnoCSS scans source files for matching class strings.

### Static vs dynamic usage

| Usage | Example | Extracted automatically? |
|-------|---------|--------------------------|
| Static — class directly in template | `<span class="i-lucide-check">` | Yes |
| Dynamic — class in a JS object/array, passed as prop | `{ icon: 'i-lucide-database' }` | **No — must safelist** |

UnoCSS cannot reliably extract class names from JS data structures. During dev-mode HMR, there's also a race between CSS injection and component rendering. Without safelisting, icons render as invisible zero-width spans — no broken-image fallback, no error.

### Safelist pattern

Any icon class used in a data structure (navigation configs, sidebar items, menu definitions) must be added to the `safelist` in `uno.config.ts`. Group entries semantically for maintainability.

```typescript
// uno.config.ts
safelist: [
  // Navigation
  'i-lucide-home',
  'i-lucide-settings',
  // Admin
  'i-lucide-database',
  'i-lucide-users',
]
```

Static icon classes in Svelte templates are extracted automatically and do not need safelisting.

## Container Queries

Container queries enable component-scoped responsive design. Wrap with `@container`, then use `@md:`, `@lg:` prefixes to respond to container width instead of viewport.

**When to use:**
| Pattern | Use Case |
|---------|----------|
| `md:` (media query) | Page-level layout changes |
| `@md:` (container query) | Component-level responsiveness |

**Container query breakpoints (custom):** `@xs` (320px), `@sm` (384px), `@md` (448px), `@lg` (512px), `@xl` (576px)

See [styling.md](../../blueprint/design/styling.md#container-queries) for detailed patterns.

## Known limitations

- **Cannot extract complex classes from `.ts` files** — opacity modifiers (`/10`) on CSS-variable colors break in all file types; CVA variant classes need scoped-CSS fallbacks (`color-mix()`). See the `unocss` skill and Button/Input components for the pattern.
- No Tailwind plugins (presets only); no built-in preflight reset.

## Related

- [bits-ui.md](./bits-ui.md) - Component library
- [images.md](./images.md) - Image optimization
