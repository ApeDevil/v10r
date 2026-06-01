# Universal Quick-Search — Ground-Truth Brief (shared context for all task-force agents)

## The goal (verbatim user intent)
> Make it so a user can find **everything** via quick-search: all showcase elements, any
> documentation content, blog posts, all website pages — basically everything that exists,
> in **all available languages**.

So: full-content, site-wide, multilingual search surfaced through the command palette
(and likely a dedicated search results page too).

---

## Ground truth — current quick-search implementation

**Component:** `src/lib/components/composites/command-palette/CommandPalette.svelte`
- Built on bits-ui `Command` + `Dialog`. Opened via `modals.quickSearchOpen` (Cmd/Ctrl-K).
- Props: `{ open, items: CommandPaletteItem[], placeholder }`.
- `CommandPaletteItem` type: `{ id, type: 'page'|'action'|'recent'|'panel', label, icon, href?, action?, secondary?, hint?, shortcut? }`.
- **CRITICAL FINDING:** `<CommandPrimitive.Root shouldFilter={false}>` and the component does
  **NOT** apply any text filter against `inputValue`. The `grouped` derived only *caps* per-group
  counts when a query is present (panels≤4, pages≤8, actions≤3) — it never filters by typed text.
  → Typing in the box does **not** narrow results today. The palette is effectively a static
  launcher, not a search. (Verify, but high-confidence from reading the source.)

**Item source:** `src/lib/components/shell/AppShell.svelte`
- `searchItems = [...pageSearchItems, ...panelSearchItems, ...3 actions]`.
- `pageSearchItems` ← `searchPages` from `$lib/nav` (page **titles** only).
- `panelSearchItems` ← `DESK_PANELS` config.
- Actions: toggle theme, keyboard shortcuts, AI assistant.

**Page registry:** `src/lib/nav/search-pages.ts` + `src/lib/nav/nav.ts`
- `searchPages` is built at module load from: (1) `navItems` (nav registry, Paraglide-i18n labels),
  (2) the `showcases` tree (`showcases.ts`, **hardcoded English** labels), (3) ~3 manual entries.
- Only titles/labels — **no body content** is indexed.

**No dedicated search library installed** (no Fuse/Orama/Pagefind/MiniSearch/FlexSearch/Lunr/
Meili/Typesense/Algolia in package.json).

---

## Content surfaces that must become searchable

1. **Showcase pages** — 86 `+page.svelte` under `/showcases/...`. Tree of cards/sublinks in
   `showcases.ts`. Plus **25 `_sections/*.svelte`** components across 9 `_sections` dirs
   (the "showcase elements" — sub-sections within a page). Labels are **hardcoded English**.
2. **Docs** — **132 markdown files** in `/docs/**`. Loaded at build time via
   `import.meta.glob('/docs/**/*.md', {query:'?raw', eager:true})` in
   `src/lib/server/docs/manifest.ts`; rendered server-side (`renderDoc`). 4 sections:
   foundation, stack, blueprint, programming. **English only** — no de/ru doc markdown exists.
   Frontmatter + derived title/description. There is a BLOCKLIST of non-public docs.
3. **Blog** — **Postgres-backed**, multi-locale. `blog` pg schema: `post` (slug, status
   draft/published/archived), `revision` (title, content, excerpt, `locale` en/de/ru,
   contentHash), `published_revision`. File-managed posts also live in
   `content/blog/<slug>/{en,de,ru}.md`. This is **dynamic** content (DB), unlike docs/showcases.
4. **Static / app pages** — home, /blog, /desk, /app/* (dashboard/account/settings/notifications),
   /auth/login, /feedback, /showcases/i18n, etc. In the nav registry.

---

## i18n setup
- Locales: **en, de, ru** (Paraglide JS, baseLocale `en`). Messages in `messages/{en,de,ru}.json`.
- URL routing: `[[locale=locale]]` optional param. `en` is bare (`/docs`), `de`/`ru` are
  prefixed (`/de/docs`, `/ru/docs`). (See memory: Vercel reroute + `[[locale]]` catch-all fix.)
- **UI strings** are translated (en/de/ru). **Docs markdown and showcase labels are EN-only.**
  Blog content is genuinely per-locale (DB revisions).
- Multilingual search must handle: German compound words, Russian Cyrillic — tokenization/stemming
  matters.

## Existing search-ish infrastructure
- **RAG retrieval** (`$lib/server/rawrag`): 3-tier recursive retrieval, **pgvector** (Postgres)
  + **Neo4j** graph, embeddings. Endpoint `POST /api/retrieval/search` (auth-gated, rate-limited,
  Valibot-validated). Built for AI/document retrieval — NOT wired to the command palette.
- This RAG infra could potentially be reused for semantic search, OR a separate lexical index
  could be built. Open question.

---

## Stack constraints (from CLAUDE.md)
- Bun runtime, SvelteKit 2 + Svelte 5 runes, Postgres (Neon serverless) + Neo4j (Aura),
  Drizzle ORM (push-only, no migrations), UnoCSS + Bits UI, Valibot + Superforms, Vercel hosting.
- **No backward-compat constraints** — greenfield, solo dev, no production users. Change code directly.
- Container-first dev; databases are remote serverless.
- Component-first rule: never raw HTML when a project component exists.

## The core challenge
Unify 4 heterogeneous surfaces — two build-time-static & EN-only (docs, showcases), one
dynamic DB & truly multi-locale (blog), one nav registry — into ONE multilingual, full-content
search index, surfaced through the command palette (and probably a `/search` page), without
bloating the client bundle, and respecting auth (some pages are gated).
