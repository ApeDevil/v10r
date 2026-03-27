# UnoCSS

## What is it?

Instant on-demand atomic CSS engine. Unlike traditional CSS frameworks, UnoCSS has no core utilities—all functionality is provided through presets. It generates only the classes actually used in code.

## What is it for?

- Building fully customized design systems without framework constraints
- Atomic CSS generation on-demand (no unused CSS shipped)
- Projects requiring maximum extensibility and performance
- Multi-context deployment: Vite, SvelteKit, Nuxt, Astro, CDN runtime

## Why was it chosen?

| Aspect | UnoCSS | Tailwind CSS |
|--------|--------|--------------|
| Generation | On-demand | Full scan + purge |
| Architecture | Isomorphic engine | PostCSS plugin |
| Bundle size | ~65% of Tailwind | Baseline |
| Core utilities | None (all via presets) | Monolithic |
| Speed | Up to 200x faster (benchmarks) | Fast |

**Key advantages:**
- No AST parsing, no PostCSS dependency—cheap string concatenation
- Full Tailwind compatibility via `preset-wind`
- Unique features: attributify mode, pure CSS icons, variant groups
- Svelte Scoped mode: inject styles directly into Svelte components
- ~6kb min+brotli, zero dependencies

**Preset ecosystem:**
| Preset | Purpose |
|--------|---------|
| `preset-wind` | Tailwind-compatible utilities |
| `preset-icons` | Any Iconify icon as CSS class |
| `preset-mini` | Minimal essential utilities |
| `preset-typography` | Prose styling |

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

**Ecosystem:**
- Smaller community than Tailwind (200K+ vs Tailwind's larger base)
- Cannot use Tailwind CSS plugins—must use UnoCSS presets
- No pre-built components (unlike Tailwind UI)
- Creator notes it's "still in early stage"

**Configuration:**
- No built-in preflight CSS reset (intentional, must configure manually)
- More initial setup than Tailwind's "works out of the box" experience
- Different mental model: preset-based vs monolithic framework

**SvelteKit-specific:**
- Requires Vite plugin setup + SvelteKit hooks
- Two integration modes to choose from (Scoped vs preprocessor)
- More configuration required than Tailwind's simpler setup

## Related

- [bits-ui.md](./bits-ui.md) - Component library
- [images.md](./images.md) - Image optimization
