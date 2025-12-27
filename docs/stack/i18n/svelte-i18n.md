# svelte-i18n

Internationalization library. ICU MessageFormat, lazy loading, active maintenance.

## Why svelte-i18n

| Aspect | svelte-i18n | sveltekit-i18n | Paraglide |
|--------|-------------|----------------|-----------|
| Last release | Oct 2024 (v4.0.1) | July 2023 (v2.4.2) | Active |
| Maintenance | Active | Seeking maintainers | Active |
| Svelte 5 | Confirmed | Unknown | Yes |
| Downloads | ~69k/week | ~3k/week | Growing |
| Bundle | 14 KB gzip | 4.6 KB gzip | Varies |
| Pluralization | ICU (standard) | Custom syntax | ICU |
| Lazy loading | Yes | Yes | No (all bundled) |

svelte-i18n wins: actively maintained, ICU standard, lazy loading.

**Why not sveltekit-i18n?** Unmaintained. Building on abandoned software is technical debt.

**Why not Paraglide?** Bundles all languages together. For 10+ languages, lazy loading is essential. Reconsider when per-locale splitting ships.

## Stack Integration

| Layer | Choice | Why |
|-------|--------|-----|
| Library | **svelte-i18n** | Active, FormatJS/ICU, lazy loading |
| Format | **ICU MessageFormat** | Industry standard, CLDR plural rules |
| Routing | **URL prefix** | SEO-friendly (`/de/about`) |

## Key Features

- **ICU MessageFormat** (industry standard pluralization)
- **Lazy loading** (load only needed locales)
- **Svelte stores** for reactive locale switching
- **FormatJS** under the hood

## URL Strategy

URL prefix pattern: `/en/about`, `/de/about`, `/fr/about`

- SEO-friendly (search engines index each locale)
- Shareable links include language
- No cookies required

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - Routing integration
- [../../blueprint/i18n.md](../../blueprint/i18n.md) - Implementation details
