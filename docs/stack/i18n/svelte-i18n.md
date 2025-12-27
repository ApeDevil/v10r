# svelte-i18n

## What is it?

Internationalization library for Svelte using reactive stores to manage locales, message dictionaries, and formatting. Lightweight wrapper around FormatJS supporting ICU MessageFormat syntax.

## What is it for?

- Runtime translation management with reactive locale switching
- Pluralization and gender selection (ICU MessageFormat)
- Lazy loading of translation files (load only needed locales)
- Number, date, and currency formatting via FormatJS
- SSR-compatible internationalization in SvelteKit

## Why was it chosen?

| Aspect | svelte-i18n | sveltekit-i18n | Paraglide |
|--------|-------------|----------------|-----------|
| Status | Active (Oct 2024) | Seeking maintainers | Active |
| Downloads | ~69k/week | ~3k/week | Growing |
| Bundle | 14 KB gzip | 4.6 KB gzip | Varies |
| Format | ICU (standard) | Custom syntax | ICU |
| Lazy loading | Yes | Yes | No (bundled) |
| Type safety | Limited | Limited | Full |

**Key advantages:**
- ICU MessageFormat (industry standard pluralization)
- Lazy loading essential for 10+ languages
- FormatJS ecosystem integration
- Svelte 5 confirmed compatible
- Active maintenance (v4.0.1, Oct 2024)

**Why not sveltekit-i18n?** Unmaintained since July 2023.

**Why not Paraglide?** Bundles all languages together. For 10+ languages, lazy loading is essential. Reconsider when per-locale splitting ships.

## Known limitations

**Maintenance status:**
- Maintainer notes library "is due to some reworking"
- Architectural changes planned but not prioritized
- Limited but ongoing maintenance

**Bundle size:**
- 14.2 KB gzipped (includes FormatJS)
- Larger than typesafe-i18n (~1 KB) or sveltekit-i18n (4.6 KB)

**SSR considerations:**
- Dynamic imports are asynchronous
- **Hydration mismatch risk:** Server uses `Accept-Language`, client uses `navigator.language`
- Requires careful setup in `hooks.server.ts` and `waitLocale()` in `+layout.ts`
- First render with `adapter-static` may miss translations if not properly awaited

**Alternatives to consider:**
- typesafe-i18n: ~1 KB, full type safety, actively maintained
- Paraglide: Compiler-based, full type safety, built-in routing

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - Routing integration
