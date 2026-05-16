# SEO & GEO

## What is it?

Search optimization for traditional search engines and AI-powered generative engines (ChatGPT, Perplexity, Claude). Dual strategy preparing for shift in search behavior.

## What is it for?

- Traditional SEO (Google, Bing)
- Generative Engine Optimization (AI search)
- Meta tags and Open Graph
- Structured data (JSON-LD)
- Sitemaps

## Why was it chosen?

| Channel | Current State | Trend |
|---------|---------------|-------|
| Traditional (Google) | 14B searches/day | Stable |
| AI (ChatGPT, etc.) | 66M prompts/day | Growing (4.4x conversion) |

Gartner predicts 50% drop in traditional traffic by 2028. Optimize for both.

**Stack advantages:**
| Component | Benefit |
|-----------|---------|
| SSR | SvelteKit default—content indexed reliably |
| Performance | Svelte compiler—fast Core Web Vitals |
| Meta tags | `<svelte:head>` + Paraglide messages—Open Graph, hreflang, canonical |
| Hosting | Vercel edge—fast TTFB |
| i18n | URL-based subpaths (`/de/`, `/ru/`)—SEO-friendly |

**GEO strategies:**
| Strategy | Impact |
|----------|--------|
| Statistics with sources | +22% visibility |
| Quotations from authorities | +37% visibility |
| Clear structure (bullets, headings) | Easier extraction |
| Summaries ("Key takeaways") | Signals extractability |

## Known limitations

**Traditional SEO:**
- Requires ongoing content updates
- Backlinks still matter (hard to control)
- Core Web Vitals requires optimization work
- Schema markup needs manual maintenance

**GEO (AI search):**
- Emerging field—strategies evolving
- No direct control over AI training data
- Citation tracking tools are paid/limited
- Reference rates not guaranteed

**Monitoring challenges:**
| Tool | Purpose | Cost |
|------|---------|------|
| Profound | AI visibility | Paid |
| Semrush AI | Prompt testing | Paid |
| Manual | Query AI directly | Free |

**Implementation priority:**
1. SEO foundation (meta tags, sitemap, JSON-LD)
2. GEO enhancement (stats, citations, structure)
3. Active GEO (track reference rates, optimize)

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
