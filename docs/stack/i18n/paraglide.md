# Paraglide JS

## What is it?

Compiler-based internationalization for SvelteKit. Compiles message files into type-safe functions with IntelliSense. Minimal runtime (~1-2KB), full tree-shaking, no hydration mismatch.

## What is it for?

- Compile-time translation compilation (messages → typed functions)
- Type-safe message keys with autocomplete
- Per-page tree-shaking (unused messages eliminated)
- URL-based locale routing via `reroute` hook
- Zero hydration mismatch (locale resolved before render)

## Why was it chosen?

| Aspect | Paraglide v2 | svelte-i18n | typesafe-i18n |
|--------|--------------|-------------|---------------|
| Bundle | ~1-2KB | 14KB (FormatJS) | ~1KB |
| Type safety | Full (typed functions) | None (string keys) | Full |
| Tree-shaking | Per-page | No (all together) | Yes |
| Hydration | No mismatch | Risk of mismatch | No mismatch |
| SvelteKit support | Official (`npx sv add`) | Community | Community |
| Routing | `reroute` hook (no params) | `[[lang]]` param | Custom |
| Maintenance | Active (Inlang team) | "Due for reworking" | Abandoned (creator passed) |

**Key advantages:**
- Smallest bundle for production (~1-2KB vs 14KB)
- Full type safety eliminates missing translation runtime errors
- Official SvelteKit integration auto-configures hooks and Vite plugin
- No server/client locale mismatch (URL/cookie resolved before render)
- Per-page tree-shaking reduces bundle per route

**Why not svelte-i18n?** 14KB runtime, no type safety, hydration mismatch risk, maintainer uncertainty ("due to some reworking").

**Why not typesafe-i18n?** Creator passed away in 2023. Library effectively abandoned.

## Known limitations

**Dev cold-start cost:**
- Compile runs in Vite's `buildStart` on every dev server start
- Cost scales linearly with `keys × locales` (~2-3 s at ~1500 keys × 3 locales)
- Output dir is watched by chokidar separately. Without `server.watch.ignored: ['**/src/lib/paraglide/**']` in `vite.config.ts`, paraglide's own re-emits trigger spurious `(ssr) page reload` events ~5 s after ready

**Language switching:**
- Requires full page reload (use `data-sveltekit-reload` on links)
- No runtime switching without reload

**Bundle splitting:**
- All locales compiled together (not split per language)
- Tree-shaken per page (unused messages eliminated)
- For 20+ languages, bundle grows (reconsider if per-locale splitting ships)

**ICU MessageFormat:**
- Supported but syntax differs slightly from FormatJS
- Pluralization and interpolation fully supported

**Locale strategy:**
- Language-only codes (`en`, `de`, `fr`) recommended
- Full locales (`de-DE`, `de-AT`) supported but formatting handled separately

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - SvelteKit routing integration
