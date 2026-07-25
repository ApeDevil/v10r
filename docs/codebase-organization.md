# Codebase Organization

This document is the **spatial map** of the repository — where code lives and where new code goes. It complements [`system-abstraction.md`](./system-abstraction.md), which owns the runtime view: request flow, the 7-layer hierarchy, and the hooks composition root. Questions about *how a request flows* belong there. Questions about *where a file lives* belong here.

---

## "Where does X live?" — Quick reference

The first and most consequential decision for any new file is **adapter vs. domain**. Getting this wrong couples business logic to the framework.

| What you're writing | Canonical path | Rule |
|---------------------|---------------|------|
| Business logic (query, mutation, service) | `src/lib/server/[domain]/` | Framework-free. No `@sveltejs/kit` or `$app/*` imports. |
| Route adapter (form actions, load fns) | `src/routes/.../+page.server.ts` | Thin wrapper. Calls domain; handles `fail()`, `redirect()`, `error()`. |
| REST / SSE endpoint | `src/routes/api/.../+server.ts` | Thin wrapper. Calls domain; handles status codes. |
| Postgres reads | `src/lib/server/db/[domain]/queries.ts` | Dominant location for incidental CRUD. **Exception:** retrieval/search domains co-locate queries inside `[domain]/queries.ts` — see [reads/writes duality](#readswrites-duality). |
| Postgres writes | `src/lib/server/db/[domain]/mutations.ts` | Same split as reads. Same exception applies. |
| Table definitions | `src/lib/server/db/schema/[namespace]/` | One file per table or cluster. Namespace = storage grouping, not call-site. |
| Drizzle relations | `src/lib/server/db/schema/relations.ts` | Centralized — one file, avoids circular imports. |
| Server Valibot schema | `src/lib/server/schemas/shared.ts` | Shared server-side shapes. |
| Client Valibot schema | `src/lib/schemas/[area]/` | Foldered to mirror route areas: `admin/ app/ blog/ showcase/`. |
| Svelte component | `src/lib/components/[layer]/[name]/[Name].svelte` | PascalCase file; kebab-case folder. Check component layers before writing raw HTML. |
| App-wide reactive state | `src/lib/state/[concern].svelte.ts` | `.svelte.ts` extension mandatory. Concern name, single-word by default (hyphenate when needed). |
| Component-local reactive state | Co-located next to the component | Named `[component].state.svelte.ts` (preferred) or `[component]-state.svelte.ts`. |
| CVA variant definitions | `src/lib/components/[layer]/[name]/[name].ts` | Kebab-case `.ts`. Scoped CSS in the `.svelte` handles actual styling (UnoCSS extraction limitation). |
| Design tokens (build-time) | `src/lib/styles/tokens.ts` | Read by `uno.config.ts`. Replaces UnoCSS defaults — spacing values differ from Tailwind. |
| Design tokens (runtime) | `src/app.css` | CSS custom properties. All color tokens live here. |
| One-off scripts | `scripts/` root or `scripts/[concern]/` | Wired via `package.json` scripts. |
| Documentation | `docs/[layer]/` | Every directory has a `README.md` nav hub. |

---

## Top-level layout

```
velociraptor/
  src/                  Application source (470 .svelte, 897 .ts, 1 .css)
  docs/                 Documentation (README-indexed, 3-layer structure)
  scripts/              Bun scripts wired via package.json
  static/               Verbatim public assets including GLB models
  content/              Markdown content source
  messages/             Paraglide translation JSON (source of truth for en/de/ru)
  assets/               Build/source assets

  svelte.config.js      SvelteKit adapter (Vercel, nodejs22.x)
  vite.config.ts        UnoCSS + Paraglide + SvelteKit plugins; ssr.noExternal: three (Threlte SSR)
  uno.config.ts         UnoCSS — reads tokens.ts; replaces default spacing
  drizzle.config.ts     db:push config; lists 14 schema namespaces
  vitest.config.ts      Test runner
  knip.config.ts        Dead-code/unused-export detection
  biome.json            Linter + formatter
  tsconfig.json
  vercel.json           Vercel deployment config
  compose.yaml          Local container composition
  Containerfile.dev     Dev container (Bun + all deps; host stays clean)
  project.inlang        Paraglide i18n project config
  package.json + bun.lock
  CLAUDE.md             Agent instructions (read this before contributing)
```

---

## `src/` structure

```
src/
  app.css               One CSS file: runtime custom properties for all color tokens
  hooks.server.ts       Composition root: 12-stage middleware sequence
  params/               SvelteKit param matchers (locale, slug, id, model)
  lib/
    components/         Layered UI (see Component Layering)
    state/              App-wide Svelte 5 runes stores (*.svelte.ts)
    schemas/            Client-importable Valibot schemas
    styles/             tokens.ts + random/ style engine + floating.ts/elevation.ts (geometry/level)
    i18n/               Runtime locale wrapper
    paraglide/          GENERATED message functions — do not edit; gitignored
    nav/                Navigation structure
    shortcuts/          Keyboard shortcut definitions
    actions/            Svelte use: actions
    analytics/          Client tracking
    config/             App configuration
    content-syntax/     Syntax highlighting helpers
    errors/             Client-side error types
    feedback/           Client feedback helpers
    showcase/           Showcase-specific client helpers
    types/              Shared TypeScript types
    utils/              Utility functions (fonts/, spreadsheet/)
    3d/                 Three.js / Threlte client helpers
    auth-client.ts      Better Auth client instance
    api.ts              CSRF-safe fetch wrapper (adds X-Requested-With header)
    branding.ts         Client-side branding utilities
    server/             Server-only domain modules (see Server Boundary)
  routes/
    [[locale=locale]]/  Localized app tree (optional-locale catch-all)
    api/                Un-localized REST/SSE tree
    robots.txt/         SEO
    sitemap.xml/        SEO
```

---

## Server boundary & domain-module anatomy

`$lib/server/` is server-only **by path**. SvelteKit refuses to bundle it client-side. No runtime guard needed — the path is the boundary. Never import `$lib/server/*` from a `.svelte` file or a universal `+page.ts`.

### ~33 domain folders

```
src/lib/server/
  abuse/        ALTCHA, honeypot, rate limits, AI budget
  admin/        Admin operations
  agents/       AI agent orchestration (booted at startup in hooks)
  ai/           Provider registry, orchestrator, tools, errors, budget
                ai/tools/ submodules: desk-read, desk-write, propose-plan,
                get-rawrag-chunks, get-llmwiki-pages, resolve-ref, search-catalog, search-docs
                Catalog siblings: catalog-citations.ts (surface verifier), tool-leak-guard.ts (Groq drift guard)
  analytics/    Analytics pipeline
  api/          Adapter helpers: pagination.ts, rate-limit.ts, response.ts
  auth/         Better Auth instance + guards (auth/index.ts constructs the instance);
                step-up.ts (Redis step-up freshness gate + twoFactorVerifyLimitKey),
                factor-changes.ts (passkey/TOTP audit+revoke+notify chokepoint),
                public-user.ts (publicUser projector — client-safe user shape; leak-gate-enforced)
                — all framework-free, never import the instance
  blog/         Posts, comments, tags, assets, feed; co-locates queries/mutations
  branding/     Custom palette resolution
  cache/        Upstash Redis wrappers
  content/      Markdown content serving
  cycle/        Cycle domain
  db/           Drizzle client + schema + query/mutation files (see db section)
  dbops/        DB refresh/mirror orchestrator: dbops.run ledger, lazy-advance executor
  desk/         AI workspace
  docs/         Documentation serving
  errors/       ServerError hierarchy
  feedback/     Single-file domain (index.ts with CRUD inline)
  graph/        Neo4j graph operations; catalog.ts seeds `:Resource`/`PART_OF` graph from showcase registry
  imagekit/     Image Kit toolkit showcase core (framework-free, NO DB): ingest, merged
                vision call, snapToAspect geometry, sharp crop, embeddings. Reuses
                imagemeta image-processing + rawrag embeddings by import; persists nothing
  imagemeta/    Image Metadata Reader core (framework-free): ingest, EXIF-strip, vision
                extract, persist to the `image` pgSchema
  jobs/         Runner, scheduler, delivery-scheduler, registered jobs
  llmwiki/      Hybrid vector+BM25 wiki search; co-locates queries
  monitoring/   Observability helpers
  neon/         Neon control-plane API client; sole NEON_API_KEY holder
  notifications/ Send, stream SSE, route, outbox, channel providers
  pairing/      Pairing-code domain
  platform/     Runtime platform detection
  preferences/  User preferences
  privacy/      GDPR aggregator: collectUserData → PersonalDataReport (Art 15/20),
                deleteUserData (Art 17). Single source of truth for "all my data";
                reads ONLY from db/, consumed by 5 surfaces (page, 3 api/me routes, export action)
  rawrag/       Three-tier retrieval pipeline; co-locates queries
  search/       Server search adapters (pages, docs, showcases, blog FTS), buildSearchIndex, searchContent;
                catalog-map.ts (formatCatalogMap — path-free system-prompt hint),
                catalog-projection.ts (deriveCatalogGraph — pure catalog → Neo4j Resource nodes),
                page-context.ts (resolvePageContext — chatbot site-awareness trust boundary;
                route id → public-catalog page label, see blueprint/ai/site-awareness.md)
  security/     Framework-free security predicates: csrf.ts (needsCsrf, isSameHost,
                CSRF_EXEMPT_PREFIXES) — imported by hooks.server.ts csrfProtection
  schemas/      Shared server Valibot: shared.ts
  store/        Desk workspace and file data; store/showcase/{image,imagekit}.ts hold
                R2 ops for the two image showcases (separate prefixes — imagekit/ is
                TTL-expirable ephemeral, image/ persists)
  style/        Style-related server logic
  test/         Test infrastructure: db.ts, fixtures.ts, vitest.setup.ts
  utils/        safe-defer.ts
  config.ts     Server-wide configuration
  features.ts   Feature flags
  shiki.ts      Syntax highlighting instance
```

### Domain module template

A typical `$lib/server/[domain]/` looks like:

```
[domain]/
  index.ts           barrel — the ONLY legal cross-domain entry point
  queries.ts         reads, no side effects
  mutations.ts       writes, explicit intent
  types.ts
  config.ts
  errors.ts
  [feature].ts       one file per capability
  *.test.ts          co-located tests
  [sub-pipeline]/    e.g. ai/tools/, ai/loop/, rawrag/tiers/, rawrag/ingest/
```

**Honest variance:**

- Tiny domains collapse to a single `index.ts` with CRUD inline (e.g. `feedback/`).
- Some `index.ts` files are construction sites, not re-exports: `auth/index.ts` builds the Better Auth instance; `ai/index.ts` exposes provider resolvers.
- Scaled domains add variant files by prefix rather than more folders: `db/ai/` has `queries.ts`, `mutations.ts`, `admin-queries.ts`, `io-log-queries.ts`, `proposals.ts`, `limits.ts`.

---

## The `db/` parallel trees

`db/` contains two co-located trees with different purposes and different naming logic.

```
src/lib/server/db/
  index.ts                   Drizzle client over Neon Pool (neonConfig.poolQueryViaFetch = true)
  id.ts                      createId — prefixed-nanoid factory
  errors.ts                  SQLSTATE → safe message
  types.ts
  shared/
    folder-tree.ts           Cross-domain helper
  schema/                    Table DEFINITIONS
    [namespace]/             One file per table or cluster
    index.ts                 Re-exports all namespace schemas
    relations.ts             ALL Drizzle relation definitions (centralized)
  [domain]/                  Data ACCESS (queries + mutations)
    queries.ts
    mutations.ts
  seed/                      Seed scripts
  showcase/                  Showcase-specific access helpers
```

### Schema namespaces (14)

`admin`, `ai`, `analytics`, `app`, `auth`, `blog`, `dbops`, `desk`, `feedback`, `image`, `jobs`, `notifications`, `rag`, `showcase`

### Access directories under `db/`

`ai/`, `analytics/`, `brand/`, `desk/`, `jobs/` (test only — see notes), `notifications/`, `preferences/`, `rag/`, `showcase/`, `user/`

### The asymmetry — by design

Schema namespaces follow **storage grouping**. Access directories follow **call sites**. They are not 1:1, and this is intentional.

| Schema namespace | Served by `db/` access dir |
|-----------------|---------------------------|
| `schema/app` (user, account, brand, preferences tables) | THREE dirs: `db/user/`, `db/brand/`, `db/preferences/` |
| `schema/auth` | Mostly Better Auth-owned; `db/user/` adds passkey read DTOs (`listPasskeyDtos`, `countPasskeys`, `touchPasskeyLastUsed`) that project secrets out |
| `schema/blog` | NO `db/` dir — `blog/queries.ts` + `blog/mutations.ts` (co-located; see below) |
| `schema/feedback` | NO `db/` dir — `feedback/index.ts` with inline CRUD |
| `schema/admin` | NO `db/` dir — admin query logic lives in `admin/` domain |

### Reads/writes duality

Postgres reads and writes live in a `queries.ts` / `mutations.ts` pair — but in **two different locations** depending on the domain:

**Dominant pattern — `db/[domain]/`**: incidental CRUD that is not the domain's core logic. Verified dirs: `db/ai/`, `db/analytics/`, `db/brand/`, `db/desk/`, `db/notifications/`, `db/preferences/`, `db/rag/`, `db/showcase/`, `db/user/`.

**Named exceptions — co-located in `[domain]/`**: domains where the queries ARE the domain logic and cannot be cleanly separated. Verified: `blog/queries.ts` + `blog/mutations.ts` (post rendering, revision management), `rawrag/queries.ts` (retrieval ranking), `llmwiki/queries.ts` (hybrid search).

**Heuristic:** if the query is incidental CRUD, put it in `db/[domain]/`. If the query IS the domain's logic (retrieval ranking, search, complex rendering), co-locate it in `[domain]/`. Present as dominant pattern + named exceptions — not an absolute law. Many domains have no query files at all (they talk to Redis, Neo4j, R2, or Better Auth instead of Postgres directly).

**Push-only workflow:** no `drizzle/` migrations directory exists. `db:push` syncs directly. Every `pgSchema()` and `pgEnum()` must be exported through `schema/index.ts` or `db:push` silently omits it.

**Relations path note:** the single relations file is `db/schema/relations.ts`. Some skill docs may say `db/relations.ts` — that path does not exist. Use the real path.

---

## Component layering & the barrel boundary

### Layer order (leaf → root)

```
src/lib/components/
  primitives/      ~40 leaf components wrapping Bits UI:
                   button, dialog, table, select, combobox, calendar,
                   switch, typography, decorative/{background,ornament}, …

  composites/      ~37 components composing primitives:
                   card, form-field, command-palette, dropdown-menu,
                   toast, confirm-dialog, dock, chatbot, page-header,
                   empty-state, altcha, …

  layout/          Stack, Cluster, PageContainer, Surface (tonal elevation — see
                   blueprint/design/tokens.md)

  shell/           App chrome — AppShell, Sidebar, Nav, UserMenu,
                   ConsentBanner. Depends on composites/primitives/layout.

  viz/             Chart.js, d3, @xyflow/svelte, maplibre-gl components
                   (chart/, graph/, plot/, diagram/, map/)

  3d/              Threlte components

  Feature dirs/    blog/ chat/ editor/ explorer/ cycle/ spreadsheet/
                   preview/ io-log/ docs/ admin/ branding/ ui/ transparency/
                   Depend DOWNWARD on composites/primitives/layout.
                   Never import each other.
```

### The barrel boundary — a bundle-size rule

The default barrel at `src/lib/components/index.ts` re-exports exactly:

```typescript
export * from './composites';
export * from './layout';
export * from './primitives';

// viz/ is intentionally excluded — import from '$lib/components/viz' directly
//   to avoid bundling Chart.js/Three.js in the default component surface.
// shell/ is intentionally excluded — app-specific, import from '$lib/components/shell'.
```

The composites barrel at `src/lib/components/composites/index.ts` further excludes `chatbot/` and `info-dialog/`:

```typescript
// chatbot/ and info-dialog/ are intentionally excluded — they import the
// markdown sanitiser, which historically pulled `jsdom` (via isomorphic-dompurify)
// and broke Vercel/Node 22 with ERR_REQUIRE_ESM. Even after swapping to
// sanitize-html, keeping these out of the default barrel prevents the chat/markdown
// graph from being unconditionally pulled into every route's import graph.
// Callers must import them directly: `$lib/components/composites/chatbot`,
// `$lib/components/composites/info-dialog`.
```

**Rule:** the default `$lib/components` barrel is the cheap surface. Anything pulling a heavy or optional dependency (viz engines, 3D, markdown sanitizer) or app-specific chrome (shell) is deep-import-only. Adding a heavy dep to a barreled component is a bundle-size regression.

Directories without a barrel — `branding/`, `admin/`, `ui/`, `docs/`, `io-log/`, `transparency/` — are deep-imported by file path.

**Dependency direction:** `primitives ← composites ← layout/shell ← feature dirs`. Feature dirs never import each other.

---

## Route organization

```
src/routes/
  [[locale=locale]]/          Optional-locale catch-all (param matcher in src/params/)
    (public)/                 Route group — no URL segment
      blog/
      docs/                   Public docs site (mirrors foundation/stack/blueprint)
      feedback/
      showcases/              86 +page.svelte files; self-documenting feature tests
    (dev)/                    Route group — 404'd in prod by devRouteGuard hook
      llmwiki-probe/
    admin/                    Admin area; gated by admin/+layout.server.ts
    app/                      Member area; gated by app/+layout.server.ts
    auth/                     Login, verify
    desk/                     AI workspace; gated by desk/+layout.server.ts
    pair/[code]/              Pairing flow
  api/                        Un-localized REST/SSE tree (no locale prefix)
  robots.txt/+server.ts
  sitemap.xml/+server.ts
```

**No `(member)` group.** The member area is the plain `app/` directory. Auth gates live in layout server files, not route groups.

### Route file vocabulary

| File | Purpose |
|------|---------|
| `+page.svelte` | UI render |
| `+page.ts` | Universal load (runs on server + client) |
| `+page.server.ts` | Server load + form actions — the adapter layer |
| `+layout.svelte` / `+layout.server.ts` | Shared layout and layout-level load/gate |
| `+server.ts` | REST/SSE endpoint |
| `+error.svelte` | Error boundary |
| `+page@.svelte` | Layout reset — breaks out of the locale layout for full-screen pages (`showcases/3d/[model]/`, `customize/[model]/`). See the global-CSS note below. |

**Route-local private folders** use an underscore: `_components/`, `_sections/`, `_data/`, `_shared/`. The SvelteKit router ignores them. Promote to `$lib/components/[layer]/` only when a second route needs the same component.

**Global CSS belongs in the root layout, not the locale layout.** `uno.css` (UnoCSS utilities), `src/app.css` (the `:root` design tokens), and the `@fontsource-variable/*` fonts are imported once in `src/routes/+layout.svelte`. The locale layout (`[[locale=locale]]/+layout.svelte`) owns app chrome + contexts, not global styles. This split is load-bearing: a `+page@.svelte` breakout sheds the locale layer, so anything it needs globally (tokens, utility classes like `fixed`/`inset-0`, fonts) must live above it at the root. The full-screen 3D viewer/customizer rendered token-less until these imports were hoisted out of the locale layout.

### Param matchers

`[[locale=locale]]` (optional locale), `[slug]`, `[id]`, `[model]`, `[...slug]` (rest catch-all), `[code]`, `[job]`

### `api/` groups (verified from file tree)

`ai/` `blog/` `admin/` `desk/` `notifications/` `retrieval/` `analytics/` `me/` (data, data/export, DELETE) `cron/[job]` `webhooks/telegram` `captcha/challenge` `style/roll` `preferences` `consent` `grant-requests` `admin/grant-requests` `announcements/[id]/dismiss` `pair/disconnect` `showcases/check-username`

### Showcase taxonomy (committed pages only)

| Area | Pages | What it covers |
|------|-------|---------------|
| `db` | 12 | Relational (3), graph (3), cache (3), storage (3) |
| `forms` | 12 | Basics (2), validation (3), advanced (3), patterns (3), auth (1) |
| `ui` | 12 | Components/primitives, tables, menus, tokens, typography, decorative, splits, workbench |
| `shell` | 7 | Errors, modals, session, shortcuts, sidebar, style, toasts |
| `analytics` | 6 | Funnels, journeys, live, my-data, overview, privacy |
| `viz` | 6 | Charts, diagrams, graphs, maps, plots + index |
| `admin` | 1 | Single page — operator transparency (former "Admin Powers" content folded in) |
| `privacy` | 5 | Cookies, data, retention, rights + index |
| `abuse` | 5 | AI-budget, captcha, honeypot, rate-limits + index |
| `ai` | 5 | Chat, retrieval (index, explorer, ingest, rag-chat), image-metadata reader |
| `toolkits` | 1 | Image Kit — upload→Run→adjust→Approve over metadata + AI cropper + embedder; persists nothing (see [blueprint/ai/image-kit.md](./blueprint/ai/image-kit.md)) |
| `3d` | 3 | Index, animated-scene, static-scene (+ layout-reset `[model]/`) |
| `auth` | 3 | (under `showcases/auth/`) |
| `cycle` | 3 | AI, API, form |
| `notifications` | 3 | Channels, pipeline, send |
| `i18n` | 1 | Single page |
| `jobs` | 1 | Single page |

---

## Naming conventions

- **Route/domain folders:** lowercase single-word (`rawrag`, `llmwiki`) or kebab-case (`grant-requests`, `asset-folders`).
- **Server `.ts` files:** kebab-case (`chat-orchestrator.ts`, `render-message.ts`).
- **Component files:** PascalCase `.svelte` (`AppShell.svelte`); their containing folder is kebab-case (`app-shell/`).
- **Runes state files:** `.svelte.ts` extension is mandatory. App-wide stores live in `src/lib/state/[concern].svelte.ts` — concern names, single-word by default with hyphenation when needed (verified 11: `chatbot-session`, `consent`, `modals`, `notifications`, `run-monitor`, `search`, `session`, `sidebar`, `style`, `theme`, `toast`). One of these — `chatbot-session` — is a deliberate **module singleton** (not a context factory): it owns the live Vely `Chat` so it survives the chat panel unmounting. See [blueprint/ai/persistent-chatbot.md](./blueprint/ai/persistent-chatbot.md). Component-local runes files co-locate next to the component, named by concern (`dock/desk-bus.svelte.ts`).
- **State file wart:** two spellings coexist for component-local state files — `.state.svelte.ts` (`dock/dock.state.svelte.ts`, `spreadsheet/spreadsheet.state.svelte.ts`) and `-state.svelte.ts` (`explorer/explorer-state.svelte.ts`, `cycle/cycle-state.svelte.ts`). New files should use `.state.svelte.ts`.
- **Barrels:** always `index.ts`.
- **Internal/special files:** leading underscore (`_better-auth.ts`, `_seed-domain.ts`).
- **Tests:** co-located as `*.test.ts`. No `__tests__/` directory or top-level test dir.
- **SvelteKit special files:** `+`-prefixed vocabulary (fixed by framework).

---

## Import-direction rules

A checklist for any new file:

1. **`$lib/server/` is server-only by path.** Never import it from a `.svelte` file or a universal `+page.ts`. No runtime guard needed.
2. **No framework imports inside domain modules.** No `@sveltejs/kit` or `$app/*` inside `$lib/server/[domain]/`. Framework coupling belongs in adapter files only: route `+*.server.ts`, `hooks.server.ts`, `auth/guards.ts`, `api/` helpers.
3. **Cross-domain access is barrel-only.** Import `$lib/server/blog`, never `$lib/server/blog/pipeline`. Domains call down, not across.
4. **`db/` is the sink.** It imports no sibling domains. Everything flows toward it. Domains may import `$lib/server/db` and reach `db/schema/[namespace]` for table objects (downward = allowed).
5. **The import graph is a DAG.** No cycles. Relations are centralized in one file for exactly this reason.
6. **Heavy/optional deps stay out of the default component barrel.** Adding viz engines, markdown sanitizer, or 3D to a barreled component is a bundle-size regression.
7. **Route-local `_components/` stay private.** Promote to `$lib/components/[layer]/` only when a second route needs them.

---

## Canonical-home decision flow

Where does a new file go? Work through these in order:

1. **Is it a thin adapter?** (handles `fail`/`redirect`/`error`, converts types, no business logic) → `src/routes/.../+page.server.ts` or `src/routes/api/.../+server.ts`
2. **Is it business logic?** → `src/lib/server/[domain]/[feature].ts`, exposed via `[domain]/index.ts` barrel
3. **Is it a Postgres query?** → Is the query inseparable from the domain's core logic (retrieval ranking, search)? → co-locate in `[domain]/queries.ts`. Otherwise → `src/lib/server/db/[domain]/queries.ts`
4. **Is it a Postgres mutation?** → Same split: co-locate if it IS the domain logic, otherwise → `src/lib/server/db/[domain]/mutations.ts`
5. **Is it a table definition?** → `src/lib/server/db/schema/[namespace]/[table].ts`; export through `schema/[namespace]/index.ts` and `schema/index.ts`
6. **Is it a Valibot schema?** → Server-only: `src/lib/server/schemas/shared.ts`. Client-importable: `src/lib/schemas/[area]/`
7. **Is it a UI component?** → Check existing layers before writing one. `primitives/` for atoms; `composites/` for compositions; `layout/` for layout primitives; feature dir for page-specific. Route-local goes in `_components/` until a second route needs it.
8. **Is it reactive state?** → App-wide: `src/lib/state/[concern].svelte.ts`. Component-local: co-locate next to the component as `[component].state.svelte.ts`.
9. **Is it a one-off script?** → `scripts/[concern]/` (if ≥2 share a concern) or `scripts/[name].ts` at root. Wire via `package.json`.

---

## `scripts/` & `docs/` organization

### `scripts/`

Subfoldered by concern when two or more scripts share it: `content/`, `db/`, `i18n/`, `perf/`. The only scripts at root are **tooling, not domain work**: the `vr` CLI runtime (`lib.sh`, `ship.sh`, `validate.sh`) and `tunnel-dev.sh`. Domain scripts run with Bun and are wired via `package.json` (`db:*`, `content:*`, `i18n:*`, `validate`). No `drizzle/` directory (push-only workflow).

### `docs/`

README-indexed three-layer structure:

```
docs/
  README.md                  Navigation hub for all docs
  system-abstraction.md      Runtime/conceptual view (7 layers, request flow)
  codebase-organization.md   Spatial map (this file)
  foundation/                Core vision, principles, architecture
  stack/
    core/                    Runtime, framework, container
    data/                    Postgres, Neo4j, Drizzle, R2
    auth/                    Better Auth
    ui/                      UnoCSS, Bits UI
    forms/                   Valibot, Superforms
    quality/                 Biome
    ops/                     Deployment
    ai/                      AI SDK
    capabilities/            3D web
    i18n/                    Paraglide
    notifications/
  blueprint/
    ai/                      AI assistant, RAG pipeline, TOON format
    app-shell/               Layout, sidebar, navigation
    db/                      Polyglot persistence, schema patterns
    data/                    Data model decisions
    design/                  Design system
    desk/                    AI workspace
    abuse/                   ALTCHA, honeypot, rate limits
    admin/                   Admin surfaces
    architecture/            Multi-client-core, middleware
    analytics/
    notifications/
    testing/
    3d/
  guides/                    How-to guides
```

Every directory has a `README.md` navigation hub: 2–3 sentence intro + topic table mapping files to topics. The public docs site at `(public)/docs/` mirrors `foundation/`, `stack/`, and `blueprint/` plus a `programming/` area.

---

## Structural notes & rough edges

These gaps are recorded, not concealed.

1. **Reads/writes duality is real.** The location of queries is not a single rule — it is a dominant pattern (`db/[domain]/`) with named exceptions (`blog/`, `rawrag/`, `llmwiki/` co-locate). A contributor who blindly follows the dominant pattern will put a retrieval-ranking query in the wrong place.

2. **Schema/access asymmetry is design, not mess.** Schema namespaces group by storage; access dirs group by call sites. The `schema/app` namespace is deliberately split across `db/user/`, `db/brand/`, `db/preferences/`. `schema/auth`, `schema/blog`, `schema/feedback`, and `schema/admin` have no `db/` access dir because their access is handled by Better Auth, co-located domain logic, or inline CRUD.

3. **`db/jobs/` holds only a test.** `src/lib/server/db/jobs/jobs.test.ts` exists, but there are no `queries.ts` or `mutations.ts` files there. Job query logic lives in the `jobs/` domain module.

4. **Relations path.** The real file is `src/lib/server/db/schema/relations.ts`. Some external skill docs or blueprint examples say `db/relations.ts` — that path does not exist.

5. **State file naming inconsistency.** Both `.state.svelte.ts` and `-state.svelte.ts` spellings exist for component-local state files. `.state.svelte.ts` is the recommended form going forward; a mass rename is not warranted.

6. **Empty showcase scaffold dirs (not in git).** Local filesystem may contain empty directories `data/`, `patterns/`, `services/`, `tokens/`, `components/` under `showcases/`. These have no committed files and are not tracked by git — they are residue from an abandoned reorganization. They are safe to `rmdir`. Do not document them as canonical architecture.

---

## Related docs

| Document | What it covers |
|----------|---------------|
| [`system-abstraction.md`](./system-abstraction.md) | Runtime view: 7-layer hierarchy, request flow, hooks pipeline, multi-client core |
| [`blueprint/architecture/multi-client-core.md`](./blueprint/architecture/multi-client-core.md) | The hexagonal core pattern in detail: four invariants, adapter patterns, auth per client type |
| [`CLAUDE.md`](../CLAUDE.md) | Agent instructions, delegation policy, component-first rule, container-first dev setup |
