# Quick Search

Universal search spanning client UI, server content, blog full-text, and prerendered indexes. The feature has two entry points — the `CommandPalette` overlay (⌘K) and the `/search` page — backed by a two-lane engine that combines instant client matching with debounced server-side FTS.

## Files

| File | Main Topics |
|------|-------------|
| **[architecture.md](./architecture.md)** | • Two-lane model (instant client + debounced server)<br>• Engine state (`createSearchEngine`), lane isolation<br>• Dedup/merge logic, result grouping by surface<br>• API endpoints (`GET /api/search`, `GET /api/search-index/[locale]`) |
| **[indexing.md](./indexing.md)** | • Prerendered per-locale Lane-A shard (titles only)<br>• Server adapters: pages, docs, showcases, sections, `_redirects`<br>• Locale model, EN-fallback badge, shard locale guard (404 on unknown locales) |
| **[blog-fts.md](./blog-fts.md)** | • App-populated per-locale `tsvector` on `blog.revision`<br>• `localeRegconfig` → english/german/russian/simple<br>• 42P17 constraint (why NOT a generated column)<br>• `searchPublishedRevisions` query, `ts_headline` with STX/ETX sentinels |
| **[ui.md](./ui.md)** | • `CommandPalette` component: `mode` prop (filter vs search), props, item types<br>• Triggers: ⌘K / Ctrl+K global, sidebar rail icon<br>• Launcher view vs query view, "Search everything" escape hatch<br>• `/search` dedicated page |
