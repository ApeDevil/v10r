# Search Architecture

## Two-Lane Model

Every search query runs two parallel, independent lanes. Results are group-stacked by surface — not RRF-fused or score-blended.

```
User types query
       │
       ├─── Lane A (instant) ────────────────────────────────────►
       │    Prerendered shard fetched once on first palette open
       │    Matched in-browser via scoreRecords() (no network)
       │    Surfaces: page / showcase / section / doc titles
       │
       └─── Lane B (debounced 300 ms) ──────────────────────────►
            GET /api/search → searchContent()
            ├── searchDocs()   full-body lexical scan (in-memory corpus)
            └── searchBlog()   live Postgres tsvector @@ websearch_to_tsquery

Both lanes emit SearchResult[]. AppShell merges by destination key,
server result wins (richer snippet). Palette renders grouped by surface.
```

**Lane A is immune to Neon cold-start.** The shard is a prerendered CDN asset; after the one lazy fetch it stays in memory for the session.

**Lane B failure is isolated.** Each sub-lane (`docs`, `blog`) is wrapped in its own `Promise.catch`. A failing blog query never kills doc results; a failing docs scan never kills blog results.

## Engine State

`createSearchEngine()` in `$lib/state/search.svelte.ts` — a Svelte 5 factory (`.svelte.ts`), not a singleton.

```
engine.instant    → SearchResult[]   (derived from in-memory shard match)
engine.async      → SearchResult[]   (latest server lane response)
engine.status     → 'idle' | 'loading' | 'done' | 'error'
engine.ensureLoaded()   prefetch shard (called on first palette open)
engine.setLocale(loc)   swap locale, reload shard
engine.setQuery(q)      drive both lanes; clears async if q is empty
engine.reset()          clear everything
```

The debounce timer is 300 ms. Stale server requests are aborted via `AbortController`.

`AppShell.svelte` owns the single engine instance and drives it via two `$effect` blocks — one for locale, one for query.

## Dedup and Merge

Both lanes use the same `SearchResult` shape (`$lib/search/types.ts`). `AppShell.svelte` merges before passing to `CommandPalette`:

```ts
const key = (r) => `${r.surface}:${r.path}:${r.anchor ?? ''}`;
for (const r of search.instant) byDest.set(key(r), r);
for (const r of search.async)   byDest.set(key(r), r);  // server wins
```

The `/search` page server load applies the same logic (static match + `searchContent`, server result wins).

## Result Grouping

Results are grouped by `SearchSurface` in a fixed display order defined in `$lib/search/types.ts`:

```ts
export const SURFACE_ORDER: SearchSurface[] = ['page', 'showcase', 'section', 'doc', 'blog'];
```

The palette caps per-group: pages → 6, showcases → 5, sections → 5, docs → 5, blog → 5, panels → 4, actions → 3.

## Surfaces and Their Sources

| Surface | Source | Lane |
|---------|--------|------|
| `page` | Nav registry (public routes only) | A |
| `showcase` | Showcase card tree | A |
| `section` | `showcaseSections` (deep-link anchors) | A |
| `doc` | Markdown manifest (titles in A, full body in B) | A + B |
| `blog` | Postgres FTS on `blog.revision` | B only |
| `panel` | `DESK_PANELS` config (client, always) | client |
| `action` | Hardcoded: toggle-theme, shortcuts, ai-assistant | client |

## API Endpoints

### `GET /api/search`

Server lane. Public route, IP-rate-limited (40 req / 10 s), Valibot-validated.

| Param | Type | Notes |
|-------|------|-------|
| `q` | string | Required. Max 200 chars. |
| `locale` | `en \| de \| ru` | Optional. Falls back to `locals.locale` then `en`. |
| `limit` | 1–50 | Optional. Defaults to 8. |
| `scope` | `all \| docs \| blog` | Optional. Defaults to `all`. |

Response: `{ data: { items: SearchResult[] } }`.

### `GET /api/search-index/[locale]`

Lane-A shard. Prerendered at build time. Returns `SearchRecord[]` (titles only, no bodies). Unknown locales → 404. Supported: `en`, `de`, `ru`.

## AI Reuse

`buildSearchIndex(locale)` and `searchContent()` are also consumed by the `search_catalog` AI tool (`src/lib/server/ai/tools/search-catalog.ts`). The tool composes both lanes in-process — same index, same merge logic, no separate embedding index. See [blueprint/ai/layered-rag.md](../ai/layered-rag.md#catalog-grounding).

## Shared Types

`$lib/search/types.ts` — client-safe, imported by both the browser engine and all server adapters.

- `SearchRecord` — indexed item (what goes into the shard and the in-memory corpus)
- `SearchResult` — ranked hit (what the palette, `/search` page, and `/api/search` all return)
- `SearchSurface`, `Locale`, `SURFACE_ORDER`

`$lib/search/match.ts` — pure lexical matcher used by Lane A (browser) and by the `/search` SSR load. Unicode-aware tokenization, AND semantics, phrase-bonus, locale-fallback rank penalty.
