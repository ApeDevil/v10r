# UI & Styling

Components, styling, state management, and forms.

## Styling

| Layer | Choice | Why |
|-------|--------|-----|
| CSS Engine | **UnoCSS** | Atomic, on-demand, smaller than Tailwind |
| Components | **Bits UI** | Headless, accessible, Svelte-native |
| Icons | **Iconify** | Unified API, tree-shakeable |
| Animations | **Svelte built-in** | Transitions, springs, tweened (0 KB) |
| Complex Animations | **Motion One** | Timelines, scroll-triggered (~3.8 KB) |

**Philosophy:** Utility-first CSS, unstyled base components, custom design tokens, no library bloat.

**Animation:** Use Svelte built-in first. Add Motion One for timelines or scroll-triggered animations.

## Images

| Layer | Choice | Why |
|-------|--------|-----|
| Static | **@sveltejs/enhanced-img** | Build-time WebP/AVIF, responsive srcset |
| Uploads | **Sharp** | Process on upload, multiple sizes in R2 |

**Strategy:** Static images optimized at build. Uploads processed once, stored at multiple sizes in R2, served via CDN.

## State

| Layer | Choice | Why |
|-------|--------|-----|
| Local | **Svelte Runes** | `$state`, `$derived`, `$effect` (0 KB) |
| Shared | **Svelte Stores** | `writable`, `readable`, `derived` (0 KB) |

Svelte's reactivity is built into the compiler. No external state library needed.

## Validation & Forms

| Layer | Choice | Why |
|-------|--------|-----|
| Validation | **Valibot** | Type-safe, ~1 KB (10x smaller than Zod) |
| Forms | **Superforms** | SvelteKit-native, Valibot integration |

**Why Valibot over Zod:**

| Aspect | Valibot | Zod |
|--------|---------|-----|
| Bundle Size | **~1 KB** | ~12 KB |
| TypeScript | Full | Full |
| Tree-shaking | Modular | Monolithic |

Valibot wins: 10x smaller, edge-friendly, Superforms support.

**Superforms:** Server validation, progressive enhancement, error handling, nested data.
