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
| Meta tags | svelte-meta-tags—easy Open Graph + JSON-LD |
| Hosting | Vercel edge—fast TTFB |
| i18n | URL-based (`/en/`)—SEO-friendly |

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

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - SSR capabilities
- [../i18n/svelte-i18n.md](../i18n/svelte-i18n.md) - URL-based i18n
- [../ops/deployment.md](../ops/deployment.md) - Edge hosting
