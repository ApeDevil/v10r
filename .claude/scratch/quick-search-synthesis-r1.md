# Universal Quick-Search — Round-1 Synthesis (input to Phase-2 cross-pollination)

8 specialists (ARY, SYS, SVEY, UXY, DATY, APY, RESY, SCOUT) consulted independently on the
same brief. This is the cross-pollination digest: what they AGREE on (settled — don't relitigate),
the HARD FACTS that constrain the design, and the genuine OPEN TENSIONS Phase 2 must resolve.

---

## A. CONSENSUS (settled — build on these, don't reopen)

- **C1. Do NOT reuse `/api/retrieval/search`.** It's an auth-gated, per-user-rate-limited 3-tier RAG
  pipeline (pgvector + Neo4j + embeddings) — wrong latency, wrong auth for keystroke-driven *public*
  search. Build a separate lightweight lexical surface. (unanimous: SYS, SVEY, APY, DATY)
- **C2. Two-lane palette.** An INSTANT client-side lane (nav/page/showcase/doc *titles*, matched in-memory,
  zero network) + a DEBOUNCED async lane for heavier full-content (blog, + maybe doc bodies). Never block
  the palette on the network. (SYS, SVEY, UXY, SCOUT)
- **C3. The current palette is broken & it's a separable quick-win.** `shouldFilter={false}` with no manual
  text filter → typing never narrows. Fixing it (real filtering for existing static items) ships
  independently of the full-content work. (UXY confirmed from source)
- **C4. Index stores locale-bare paths; localize at the navigation edge** via `localizeHref()`. Never bake a
  locale into stored hrefs. (SYS, SVEY)
- **C5. "All languages" = localized chrome + per-locale BLOG; docs/showcases stay EN with a visible "EN"
  badge for de/ru users.** No de/ru doc markdown exists; live MT in the hot path is rejected. → PRODUCT
  DECISION to confirm with user. (SYS, UXY)
- **C6. Two real leaks to fix before shipping:** (1) `searchPosts()` has no `status`/`deletedAt` filter →
  drafts & soft-deleted posts are full-text-matchable; (2) `searchPages` exposes `/app/*` + admin pages to
  all users. Filter by session + published-only. (SYS)
- **C7. Showcase "elements" = `_sections` need stable anchor IDs + curated `keywords[]` in a registry.**
  Do NOT scrape visible text from the 25 dense `_sections/*.svelte` (noisy). Deep-link via `href#anchor`;
  section headings need `tabindex="-1"` for focus on anchor nav. (DATY, UXY, ARY)
- **C8. One flat, ranked `SearchResult[]` DTO** shared by BOTH the palette and a `/search` page (multi-client
  consistency); each client groups/caps locally. Snippets are SERVER-provided and HTML-FREE (plain text +
  `[start,end]` highlight ranges rendered via `<mark>`, never `{@html}`; neutralize `ts_headline` markup). (APY)
- **C9. Delete `src/lib/nav/search-pages.ts`; derive the index from the registries** (`nav.ts`, showcases tree).
  Move `routes/.../showcases/showcases.ts` → `$lib/...` (kills the only `$lib → routes` back-edge). (ARY)
- **C10. Add a dedicated `/search` results page** sharing ONE query module with the palette; palette's
  "More results →" / Enter navigates to `/search?q=…`. (SVEY, UXY, APY)
- **C11. Public endpoint = IP-keyed rate limit** (`getClientIp` + `createLimiter`, the check-username/captcha
  pattern), not user-id keyed. Reuse `apiOk/apiError/apiValidationError` + Valibot. (APY)

---

## B. HARD FACTS (verified, sourced — these bound the solution space)

- **F1. pg_search (ParadeDB BM25) is DEPRECATED on Neon (2026-03-19), unavailable for new projects.**
  Only NATIVE Postgres `tsvector`/`tsquery` is available. (RESY, sourced)
- **F2. Generated tsvector columns are out.** Neon rejects multi-field `to_tsvector(regconfig,…)` in GENERATED
  columns (SQLSTATE 42P17, DATY verified on the live pattern), AND `drizzle-kit push` ignores generated-column
  expression changes (SCOUT/RESY sourced). → tsvector MUST be **app-populated**, exactly like the existing
  `rag.llmwiki_page.searchVector` precedent. A one-time raw-DDL bootstrap for the column+GIN index, never via push.
- **F3. Neon cold start = 300–600ms (worst-case 1.8–3.1s) from scale-to-zero.** → Postgres CANNOT be the
  *instant* lane. It's acceptable for the DEBOUNCED async lane (spinner). This RECONCILES with C2:
  instant=client-static, async=Postgres-blog. (RESY, SCOUT sourced)
- **F4. German compound words are NOT split by any Snowball engine** (Postgres `german`, Pagefind, Orama).
  LOW impact here: docs are EN-only; German blog is human-authored full words. Note, don't block on it. (RESY, SCOUT)
- **F5. Pagefind cost of entry on THIS stack is real:** needs an HTML corpus → SvelteKit SSR routes produce no
  build-time HTML, so it requires the community "SvelteVietnam" Vite plugin (spin up `vite preview`, crawl
  rendered HTML, feed Pagefind's Node API) + a Vercel `.vercel/output/static` path fix + a dev-mode stub +
  per-language indexes (no native cross-language search) + `destroy()/init()` on Paraglide locale switch.
  Upsides: sub-result anchors, multilingual stemming, ~50KB/query shard fetch, no DB cold-start. (RESY, SCOUT sourced)
- **F6. Orama downloads the FULL index before first search** (~600KB for comparable sites; locale filtering
  "unsupported" in static mode; no sub-result anchors) → weaker fit than Pagefind for this size. (SCOUT sourced)

---

## C. THE THREE-WAY ENGINE SPLIT (the heart of Phase 2)

There is genuine disagreement on the engine for the **static content** (docs bodies + showcase sections + pages).
Blog is settled: **live Postgres FTS** (per-locale `regconfig`, status-filtered). The split is everything else:

- **Camp POSTGRES-UNIFIER (DATY, leaning APY):** one app-populated `search.record` table holding ALL four
  surfaces (docs/showcases/pages materialized at build, blog upserted on publish). ONE GIN index, ONE ranked
  `@@` query, per-row `regconfig`, `setweight` A/B/C, `typeBoost`. Pro: single query, globally comparable
  ranking, multilingual via DB. Con: Neon cold start on the hot path (mitigated only if static lane is client),
  materializing static content into DB, app-populated tsvector maintenance.
- **Camp CLIENT-STATIC + SERVER-BLOG (SYS, SVEY):** small build-time JSON index of static content shipped/lazy-
  loaded to the client (MiniSearch or hand-rolled), matched instantly in-browser; blog via debounced
  `/api/search` Postgres FTS; merge with the existing `rrf()` fusion helper (`llmwiki/search.ts`). Pro: instant,
  no cold-start for the common case, no Pagefind build complexity. Con: how much doc BODY ships to the client?
  (titles+descriptions+headings = small; full 132-doc bodies = too heavy.)
- **Camp PAGEFIND-HYBRID (RESY, SCOUT):** Pagefind for static (full body + anchors + multilingual, fetched as
  CDN shards) + Postgres FTS for live blog, merged client-side. Pro: real full-body doc search, anchors,
  no cold-start, proven on docs sites. Con: F5 build complexity on SvelteKit-SSR/Vercel/Paraglide.

**THE SWING FACTOR everyone circles:** *Do we need full doc-BODY search, or is
title + description + headings + curated keywords enough for the instant lane?*
- If title/heading-level is enough → Camp CLIENT-STATIC wins (simplest, instant, no Pagefind, no cold-start).
- If full-body doc search is required ("any documentation content" implies it) → either materialize doc bodies
  into Postgres (Camp POSTGRES) or adopt Pagefind (Camp PAGEFIND). A middle path: instant client lane on
  titles/headings + server lane (Postgres-materialized doc bodies) for full-text, merged.

---

## D. OPEN TENSIONS for Phase 2 to resolve (decision-oriented)

- **T1 — Engine for static content.** Pick among the three camps above (or a named hybrid). MUST account for
  F1/F2/F3/F5. State what doc-body depth you assume and why.
- **T2 — Where merge+rank lives.** Server-side single `/api/search` that itself fuses static+blog (APY:
  one contract, multi-client) vs client-side two-lane merge (SYS/SVEY: instant static, zero round-trip).
  Reconciliation candidate: shared framework-free DOMAIN function in `$lib/server/search/` that `/search`
  SSR-load and `/api/search` both call; the palette additionally runs a client static lane. Converge on ONE.
- **T3 — Blog freshness.** Live Postgres query (preserve real-time; SYS/DATY) vs build-time bake
  (Pagefind addCustomRecord → stale until redeploy; RESY/SCOUT note this). Consensus leans LIVE. Confirm.
- **T4 — Full doc-body home (if needed).** in-memory server scan of the already-globbed `rawModules`
  (SYS) vs materialize into Postgres `search.record` (DATY) vs Pagefind shards (RESY/SCOUT).
- **T5 — DB provenance check.** DATY flagged: `blog.revision.search_vector` is QUERIED but no creation site
  found in repo ("raw SQL migration" comment) — confirm it exists in the live DB before depending on the pattern.

---

## E. Round-1 KEY POSITIONS per agent (for reference)

**ARY:** new server domain `$lib/server/search/` + client-safe `$lib/search/types.ts` (mirrors docs split);
ranking query co-located (`query.ts`), not in `db/`; delete `search-pages.ts`; move `showcases.ts` into `$lib`;
ONE `SearchRecord` + ONE `SearchAdapter.collect()` interface, 4 independent adapters; strictly downward imports.

**SYS:** freshness is TWO-CLASS, merge at query time, never one baked index; hybrid two-lane (client static +
debounced/aborted server blog) fused via `rrf()`; locale threads through 3 points differently per source; "all
languages"=localized chrome over EN corpus; fix the 2 leaks + add abort/sequence guard for stale responses.

**SVEY:** hybrid delivery — prerendered per-locale static JSON shards (lazy on first palette open, locale-neutral
paths, prefix at render) + live `+server.ts` for blog; lazy-load whole search module like the Chatbot; build the
static index via a `prebuild` Bun script (import.meta.glob lives in Vite's graph); `/search` page (`+page.ts`)
shares the query module.

**UXY:** `shouldFilter` fix is separable; two-phase results non-negotiable; EN-only content needs a visible "EN"
badge (trust); per-group caps + "More in /search"; 3-density result rows w/ breadcrumb + type badge + bolded
snippet; full a11y (combobox/listbox, aria-live count, focus return, 44px targets); recent-searches in
localStorage; add a visible search button to advertise ⌘K.

**DATY:** Postgres FTS as the unifier via ONE app-populated `search.record` table; tsvector app-written (F2),
per-row `regconfig` enum; one row per (source, locale), docs/showcases = single EN row w/ `localeFallback=true`;
curated `keywords[]` for sections; derived projection w/ explicit invalidation (build step for static, publish-txn
upsert for blog, `db:search-rebuild` reconcile); carries `typeBoost`/`recencyAt`/`authScope` ranking+visibility inputs.

**APY:** ONE public `GET /api/search` parallel to (never reusing) retrieval; static-vs-live hybrid hidden BEHIND
the contract (server merges, clients never do); flat ranked `SearchResult[]` + `facets` + opaque cursor (palette
ignores it); IP rate-limit; server-provided HTML-free snippets+highlight ranges; `plainto_/websearch_to_tsquery`
injection-safe; q≤200. Flagged: introduce a shared `encodeCursor`/`decodeCursor` primitive (none exists).

**RESY:** Pagefind+`addCustomRecord` is the documented static-engine path (multilingual, anchors, shards);
pg_search deprecated (F1); generated tsvector unusable (F2); Neon cold start risk (F3); German compounds unsolved
(F4); recommends Pagefind(static)+Postgres-FTS(blog) two-engine hybrid, results federated in UI.

**SCOUT:** real-world: Pagefind needs the SvelteVietnam SSR Vite-plugin + Vercel path fix (F5); Orama downloads
full index (F6); two-mode palette (instant nav + debounced content) has NO canonical Svelte/Bits-UI example —
adapt the React shadcn `shouldFilter={false}` + manual-debounce pattern; recommends Pagefind(static)+Postgres(blog),
or — if cold starts hurt — bake blog into Pagefind at build (accept staleness) + redeploy on publish.
