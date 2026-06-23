# SEO & GEO

Dual strategy: traditional search engines (Google, Bing) and AI generative engines (ChatGPT, Perplexity, Claude).

## Why was it chosen?

The stack is SEO-favorable: SvelteKit SSR indexes reliably, the Svelte compiler keeps Core Web Vitals fast, and URL-based i18n subpaths (`/de/`, `/ru/`) are search-friendly. Meta tags emit via `<svelte:head>` + Paraglide (Open Graph, hreflang, canonical).

## Known limitations

- **GEO is an emerging field** — no control over AI training data; citation/reference rates aren't guaranteed and tracking tools are paid.

## Implementation

### Canonical + hreflang

`src/routes/[[locale=locale]]/+layout.svelte` emits a **self-referential canonical** per locale — `/de/blog` canonicals to `/de/blog`, never to `/blog`. De-localizing the canonical would tell Google translated pages are duplicates and suppress them from the index.

hreflang alternates cover all locales + `x-default` (pointing to the en/unprefixed URL). The sitemap repeats these alternate links so both signals are consistent.

See `docs/blueprint/i18n.md` §Canonical and §Hreflang Tags for the pattern.

### Sitemap

`src/routes/sitemap.xml/+server.ts` — single site-wide sitemap, dynamic (DB-backed). It cannot be prerendered because it includes published blog posts whose list changes at runtime. CDN-cached for 1h via `Cache-Control: s-maxage=3600`. Emits 3 `<url>` blocks per logical page (en unprefixed, `/de`, `/ru` prefixed), each with reciprocal `xhtml:link rel="alternate"` hreflang tags + `x-default`. `<lastmod>` only on blog posts (from `publishedAt`); omitted on static pages. `<priority>` and `<changefreq>` omitted (Google ignores them).

### robots.txt

`src/routes/robots.txt/+server.ts` — env-aware via `VERCEL_ENV`:
- **Production**: `Allow: /`, blocks `/api/`, `/app/`, `/de/app/`, `/ru/app/`; absolute `Sitemap:` URL.
- **Preview / development**: `Disallow: /` — blocks indexing of preview deployments (Vercel only auto-noindexes `*.vercel.app`, not custom-domain previews).

The old `static/robots.txt` was deleted — a static file shadows the dynamic route.

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - SSR capabilities
- [../i18n/paraglide.md](../i18n/paraglide.md) - URL-based i18n, hreflang strategy
- [../ops/deployment.md](../ops/deployment.md) - Edge hosting
- [../../blueprint/i18n.md](../../blueprint/i18n.md) - Canonical + hreflang implementation patterns
