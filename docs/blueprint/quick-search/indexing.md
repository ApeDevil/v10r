# Search Indexing

## Lane-A Shard

The Lane-A shard is a prerendered JSON array of `SearchRecord` objects — titles only, no body text. It is built at deploy time by `buildSearchIndex(locale)` in `$lib/server/search/query.ts` and served as a static CDN asset.

**Route:** `GET /api/search-index/[locale]`
**Handler:** `src/routes/api/search-index/[locale]/+server.ts`
**Prerender:** `export const prerender = true`
**Entries:** `en`, `de`, `ru`

Unknown locales (e.g., `/api/search-index/fr`) return `[]` with HTTP 404.

The shard is lazy-fetched on the first palette open and held in memory for the session. Locale switches trigger a fresh fetch.

## Server Adapters

All adapters live in `$lib/server/search/adapters/` and produce `SearchRecord[]`.

### `pages.ts`

Source: the nav registry (`$lib/nav`). Paraglide labels — genuinely localized, no fallback badge.

**Filters out** `/app/*` and `/admin/*` paths: anonymous search never reveals protected route existence. Also excludes hub-only redirect paths listed in `_redirects.ts`.

### `showcases.ts`

Source: showcase card tree (`$lib/showcases/registry`) + curated in-page sections (`$lib/showcases/sections`).

English-only. For `de`/`ru` users: `localeFallback: true`, rendered with an "EN" badge and a small rank penalty.

Sections produce `surface: 'section'` records with `anchor: '#anchorId'` for deep linking. Keywords come from curated `section.keywords` arrays.

### `docs.ts`

Source: build-time markdown manifest (`$lib/server/docs/manifest`).

Two output modes:
- **Lane A** (`docTitleRecords`): title + description, no body. `localeFallback: true` for non-EN locales.
- **Lane B** (`searchDocs`): full-body lexical scan with `scoreRecords()` + `extractSnippet()`. The corpus is built once per server instance (module-level cache). No DB round-trip — docs are already eager-globbed into the server bundle at deploy time.

Markdown is stripped to plain text before indexing: fenced code blocks, inline code, links, HTML tags, heading/list markers, emphasis characters, table pipes.

### `_redirects.ts`

A `Set<string>` of hub-only hrefs that only redirect to a child page. Excluded from the index so search never lands a user on a bounce page.

## Locale Model

Docs and showcase content is English-only today. Non-EN users see these results with:
- `localeFallback: true` on the `SearchRecord`
- `badge: 'en-fallback'` on the `SearchResult`
- An "EN" badge rendered next to the title in the palette and `/search` page
- A 15% rank penalty (`score *= 0.85`) so native-locale results rank above EN fallbacks

Paths in the shard are **locale-bare** (e.g., `/docs/stack/svelte`). `localizeHref()` is called at render time, not at index time. This means the shard works for all locales without duplication.

The architecture is locale-parameterized: when native `de`/`ru` markdown is authored later, only the adapter needs a `locale` dimension. The search engine, shard endpoint, and client code are unchanged.

Page records (`pages.ts`) are not locale-fallbacks because nav labels are genuinely localized via Paraglide — the German user sees German page names.

## `buildSearchIndex(locale)`

```ts
function buildSearchIndex(locale: SearchLocale): SearchRecord[] {
  // Pins Paraglide locale so nav labels render in the right language.
  return [...pageRecords(locale), ...showcaseRecords(locale), ...docTitleRecords(locale)];
}
```

Called by the `+server.ts` shard handler at prerender time. Also called directly by the `/search` SSR load function (no self-fetch needed server-side).
