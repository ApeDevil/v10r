# UI & Styling

Components, styling, state management, and forms.

## Styling

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| CSS Engine | **Atomic CSS** | UnoCSS | On-demand, smaller than Tailwind |
| Components | **Headless UI** | Bits UI | Accessible, Svelte-native |
| Icons | **SVG Icons** | Iconify | Unified API, tree-shakeable |
| Animations | **Svelte Transitions** | Built-in | Springs, tweened (0 KB) |
| Complex Animations | **Web Animations** | Motion One | Timelines, scroll-triggered (~3.8 KB) |

**Philosophy:** Utility-first CSS, unstyled base components, custom design tokens, no library bloat.

**Animation:** Use Svelte built-in first. Add Motion One for timelines or scroll-triggered animations.

**Swappability:** All are libraries, not services. No vendor lock-in.

## Images

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Static | **Build-time optimization** | @sveltejs/enhanced-img | WebP/AVIF, responsive srcset |
| Uploads | **Server-side processing** | Sharp | Process on upload, multiple sizes |
| Storage | **S3 API** | [Cloudflare R2](./vendors.md#cloudflare-r2) | Zero egress, CDN delivery |

**Strategy:** Static images optimized at build. Uploads processed once, stored at multiple sizes in R2, served via CDN.

## State

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Local | **Svelte Runes** | Built-in | `$state`, `$derived`, `$effect` (0 KB) |
| Shared | **Runes + `.svelte.ts`** | Built-in | Factory pattern with `$state` in modules (0 KB) |

Svelte 5's runes work universally — in components AND in `.svelte.ts` modules. No external state library needed.

**Pattern:** Export getters (not raw `$derived`) from `.svelte.ts` files. See [blueprint/state.md](../blueprint/state.md).

**Swappability:** Framework-native. No external dependencies.

## Validation & Forms

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Validation | **Schema validation** | Valibot | Type-safe, ~1 KB (10x smaller than Zod) |
| Forms | **Form handling** | Superforms | SvelteKit-native, Valibot integration |

**Why Valibot over Zod:**

| Aspect | Valibot | Zod |
|--------|---------|-----|
| Bundle Size | **~1 KB** | ~12 KB |
| TypeScript | Full | Full |
| Tree-shaking | Modular | Monolithic |

Valibot wins: 10x smaller, edge-friendly, Superforms support.

**Superforms:** Server validation, progressive enhancement, error handling, nested data.
