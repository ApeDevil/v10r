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
