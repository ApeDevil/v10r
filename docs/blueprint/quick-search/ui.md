# Search UI

## CommandPalette Component

`$lib/components/composites/command-palette/`

| File | Role |
|------|------|
| `CommandPalette.svelte` | Modal overlay + grouped result list |
| `command-palette.ts` | CVA variants (overlay, content) |
| `types.ts` | `CommandPaletteItem`, `CommandPaletteItemType` |
| `index.ts` | Re-exports |

Built on Bits UI `Command` + `Dialog` primitives. `shouldFilter={false}` — all filtering is handled by the engine or the component's own derived state, not by the Bits UI filter.

### Props

```ts
interface Props {
  open: boolean;          // bindable
  items: CommandPaletteItem[];
  query?: string;         // bindable — parent drives the search engine
  placeholder?: string;
  mode?: 'filter' | 'search';
  loading?: boolean;      // shows spinner in search mode
}
```

### `mode` Prop

| Mode | Behavior |
|------|----------|
| `'filter'` (default) | Self-contained. Filters ALL items by query client-side. Use for demos (e.g., showcase page). |
| `'search'` | Real universal search. Command items (panel/action/recent) are filtered client-side; search-surface items (page/showcase/section/doc/blog) arrive pre-matched and are rendered as-is. |

`AppShell.svelte` always uses `mode="search"`.

### Item Types

`CommandPaletteItemType = 'page' | 'action' | 'recent' | 'panel' | 'showcase' | 'section' | 'doc' | 'blog'`

Items carry optional `snippet` (plain text) and `highlight` ([start, end] ranges) for rich search result display. Highlights are rendered with `<mark>` — never `{@html}`.

Items carry optional `badge: 'en-fallback'` for English content shown to de/ru users.

Items carry optional `secondary` for a hover-revealed icon button (e.g., "Open in new tab" on desk panels).

### Launcher View vs Query View

When the query is empty, the palette shows only recents, panels, and actions. Search-surface groups (pages, showcases, docs, blog) are hidden. When query is non-empty, all groups appear (capped per group).

### "Search Everything" Escape Hatch

In `mode="search"`, a "Search everything for …" button appears below the results. Selecting it navigates to `/search?q=<query>`. Keyboard shortcut: `↵` on that item.

## Triggers

### ⌘K / Ctrl+K

Registered globally in the keyboard shortcut registry. Opens `modals.quickSearchOpen` from anywhere in the app.

### Sidebar Rail Icon

A search icon in the left sidebar rail opens the palette. Wired in `AppShell.svelte` via the `Sidebar` component.

On first open, `search.ensureLoaded()` is called to prefetch the Lane-A shard.

## Keyboard Navigation

Standard Bits UI Command keyboard behavior:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move between items |
| `Enter` | Select highlighted item |
| `Escape` | Close palette, clear query |
| `⌘K` / `Ctrl+K` | Open palette globally |

## AppShell Wiring

`CommandPalette` is mounted once in `AppShell.svelte`:

```svelte
<CommandPalette
  bind:open={modals.quickSearchOpen}
  bind:query={searchQuery}
  items={searchItems}
  mode="search"
  loading={search.status === 'loading'}
/>
```

`searchItems` merges: deduped search results + desk panel items + hardcoded actions (toggle theme, keyboard shortcuts, AI assistant).

## `/search` Page

Route: `src/routes/[[locale=locale]]/(public)/search/+page.svelte`
Load: `src/routes/[[locale=locale]]/(public)/search/+page.server.ts`

A dedicated full-page search view. Accepts `?q=` query param. Results are grouped by surface in the same `SURFACE_ORDER` as the palette. The page is `noindex` (meta robots).

The load function runs both lanes server-side (no client fetch): `match(buildSearchIndex(locale), q, 50)` for static hits, `searchContent(q, { locale, limit: 50 })` for server hits. Same merge logic as the palette (server result wins for richer snippet), then sorted by descending score.

```
┌────────────────────────────────────┐
│  Search                            │
│  3 results for "svelte"            │
├────────────────────────────────────┤
│  PAGES                             │
│  [icon] SvelteKit                  │
│         Docs / Stack               │
├────────────────────────────────────┤
│  DOCS                              │
│  [icon] Svelte 5 Runes             │
│         Docs / Stack               │
│         …reactive variables that…  │ ← snippet with bold matches
│  [icon] SvelteKit 2                │
│         Docs / Stack               │
└────────────────────────────────────┘
```

## Not Yet Implemented

- Recent searches (localStorage persistence)
- Doc heading-level deep anchors in results
- `/docs/programming` agents section indexing
