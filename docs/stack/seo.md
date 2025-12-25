# SEO & GEO

Search optimization for traditional search engines and AI-powered generative engines.

## Why Both

| Channel | Current State | Trend |
|---------|---------------|-------|
| Traditional (Google) | 14B searches/day | Stable, dominant |
| AI (ChatGPT, Perplexity) | 66M prompts/day | Growing, 4.4x conversion |

Gartner predicts 50% drop in traditional traffic by 2028. Optimize for both.

## Traditional SEO

SvelteKit has SSR by default. Content is indexed reliably.

### Meta Tags

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Library | **Meta tag management** | svelte-meta-tags | Open Graph, Twitter Cards, JSON-LD |
| Alternative | **Native HTML** | `<svelte:head>` | Zero deps, manual control |

Return SEO data from `load()`, use in layout via `<svelte:head>`.

**Swappability:** Both are library/framework-native. No vendor dependency.

### Essential Tags

| Tag | Purpose | Location |
|-----|---------|----------|
| `<title>` | Page title (50-60 chars) | Per-page |
| `meta description` | Search snippet (150-160 chars) | Per-page |
| `canonical` | Prevent duplicates | Per-page |
| `charset`, `viewport` | Document basics | `app.html` |
| `og:*` | Social previews | Per-page |

### Sitemap

Generate dynamic sitemap via `/sitemap.xml` endpoint. Use `import.meta.glob` to crawl routes, filter dynamic routes, return XML.

### Structured Data

Helps search engines understand content and display rich snippets.

| Schema | Use Case |
|--------|----------|
| `Article` | Blog posts, news |
| `Product` | E-commerce |
| `FAQ` | Q&A pages |
| `HowTo` | Tutorials |
| `Organization` | Company info |
| `BreadcrumbList` | Navigation |

Add JSON-LD in `<svelte:head>` via `{@html}`.

### Technical Checklist

- [x] SSR enabled (SvelteKit default)
- [ ] `robots.txt` in `/static`
- [ ] Sitemap at `/sitemap.xml`
- [ ] Canonical URLs
- [ ] Open Graph tags
- [ ] JSON-LD structured data
- [ ] Core Web Vitals optimized
- [ ] Mobile-responsive

## GEO

Generative Engine Optimization for AI search (ChatGPT, Perplexity, Claude, Google AI Overviews).

### Differences from SEO

| Aspect | Traditional SEO | GEO |
|--------|-----------------|-----|
| Ranking signal | Backlinks | Citation authority |
| Content format | Keywords | Semantic density |
| Query length | ~4 words | ~23 words (conversational) |
| Success metric | Click-through rate | Reference rate |
| Output | Link list | Synthesized answer |

### Optimization Strategies

| Strategy | Implementation | Impact |
|----------|----------------|--------|
| **Statistics** | Real data with sources | +22% visibility |
| **Quotations** | Cite authorities | +37% visibility |
| **Structure** | Bullets, clear headings | Easier extraction |
| **Summaries** | "In summary", "Key takeaways" | Signals extractability |
| **Schema** | FAQ, HowTo, Product | Machine-readable |

### Content Structure

LLMs extract better from:

1. **Clear hierarchy** - H1 → H2 → H3
2. **Semantic density** - Meaning over keywords
3. **Parseable format** - Bullets, lists, tables
4. **Authority** - Stats, citations, quotes

Skip marketing speak. Use concrete data and citations.

### Metrics

| Metric | Measures | Track With |
|--------|----------|------------|
| **Reference Rate** | AI citation frequency | Profound, Goodie |
| **Unaided Awareness** | Brand mentions unprompted | Manual testing |
| **Citation Volume** | Times sourced | GEO tools |
| **AI Referrals** | Clicks from AI | Analytics |

### Monitoring

| Tool | Purpose | Cost |
|------|---------|------|
| **Profound** | AI visibility | Paid |
| **Semrush AI** | Prompt testing | Paid |
| **Manual** | Query ChatGPT/Perplexity | Free |

### Implementation Priority

**Phase 1: SEO Foundation**
- Meta tags
- Sitemap
- JSON-LD schemas
- Core Web Vitals

**Phase 2: GEO Enhancement**
- Add statistics and citations
- Clear summaries
- FAQ and HowTo schemas
- Monitor AI referrals

**Phase 3: Active GEO**
- Track reference rates
- Optimize based on citation patterns
- Ensure presence in LLM training sources

## Stack Integration

| Component | Technology | Provider | Benefit |
|-----------|------------|----------|---------|
| **SSR** | Server rendering | SvelteKit | Content indexed reliably |
| **Performance** | Compiler | Svelte | Fast Core Web Vitals |
| **Meta tags** | Tag management | svelte-meta-tags | Easy Open Graph + JSON-LD |
| **Hosting** | Edge network | [Vercel](./vendors.md#vercel) | Edge caching, fast TTFB |
| **i18n** | URL-based routing | sveltekit-i18n | SEO-friendly routes |

**Why ready:** SSR default, minimal JS, fast loads, clean URLs, structured data support.

**Swappability:** Only Vercel is a vendor. All others are libraries/framework features.
