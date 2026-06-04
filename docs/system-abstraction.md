# System Abstraction

The v10r system is organized as a **seven-layer abstraction hierarchy** where each layer is built from the one above it. Data flows down from HTTP edge to infrastructure; events and responses bubble back up. This document is the entry-point map for understanding how the whole system fits together — read it before diving into any single layer.

Two physical spines hold all seven layers together: a **composition root** (`src/hooks.server.ts`) that owns cross-cutting concerns, and a **hexagonal core** (`src/lib/server/[domain]/`) where all business logic lives, insulated from the framework.

---

## The Hierarchy at a Glance

```
Layer                    Canonical Home
─────────────────────────────────────────────────────────────────────────────
1  Tech Stack            root config (svelte.config.js, vite.config.ts,
                         uno.config.ts, drizzle.config.ts, package.json)
                         + Containerfile.dev / compose.yaml

2  Architecture          src/hooks.server.ts  (composition root)
                         + multi-client-core pattern
                         server/client boundary = the $lib/server/ path

3  Services/Applications src/routes/[[locale=locale]]/  (app/, admin/, desk/,
                         auth/, (public)/showcases/)
                         + parallel src/routes/api/ tree

4  Modules               src/lib/server/[domain]/
                         + src/lib/[client-domain]/
                         public surface = each module's index.ts barrel

5  Components            src/lib/components/[layer]/
                         primitives → composites → layout/shell → feature dirs

6  Classes/Functions     files inside a module/component folder;
                         private unless re-exported from folder's index.ts

7  Code                  leaf .ts / .svelte / .css;
                         design tokens at src/lib/styles/tokens.ts + src/app.css
─────────────────────────────────────────────────────────────────────────────
```

The seven layers collapse into two physical spines:

- **Composition root** — `src/hooks.server.ts` wires together Layers 1–3: it boots background modules, runs a 12-stage `sequence()` of `Handle` middleware, and hands a fully populated `event.locals` to every route adapter.
- **Hexagonal core** — `src/lib/server/[domain]/` houses Layers 4–6: framework-free domain modules that any adapter (UI, REST, AI tool, job) can call without modification.

---

## Layer 1 — Tech Stack

The foundation is declared in root config files and `Containerfile.dev`; nothing above Layer 1 should care which specific vendors implement it.

**Runtime environment**

| Concern | Technology |
|---------|-----------|
| Container | Podman (`Containerfile.dev`, `compose.yaml`) |
| Runtime | Bun |
| Framework | SvelteKit 2 + Svelte 5 (runes) |
| Host | Vercel (`@sveltejs/adapter-vercel`, nodejs22.x) |
| Code quality | Biome |

**Data stores (polyglot persistence)**

| Store | Technology | Role |
|-------|-----------|------|
| Relational | PostgreSQL via Neon serverless (`@neondatabase/serverless`) | Universal floor — all CRUD, analytics, jobs |
| ORM | Drizzle (`drizzle-orm`, `drizzle-kit`) | Type-safe SQL |
| Graph | Neo4j Aura (Bolt) | RAG tier-3 graph expansion only |
| Cache / rate-limit | Upstash Redis (`@upstash/ratelimit`, `@upstash/redis`) | Rate limits, AI daily budget, Better Auth secondary storage |
| Object storage | Cloudflare R2 via S3 API (`@aws-sdk/client-s3`) | Blog media, avatars |

**Application concerns**

| Concern | Technology |
|---------|-----------|
| Auth | Better Auth (session-based) |
| Validation | Valibot + Superforms |
| Styling | UnoCSS + Bits UI |
| i18n | Paraglide JS (en / de / ru) |
| AI | Vercel AI SDK v6 (`ai@^6`, `@ai-sdk/{google,groq,openai,svelte}`) |
| 3D | Three.js + Threlte |
| Abuse prevention | ALTCHA (`altcha`, `altcha-lib`) |
| Visualization | d3 (force/dag/hierarchy/sankey/zoom), chart.js, @xyflow/svelte, maplibre-gl |
| Markdown | unified / remark / rehype / shiki |

**Design principles** (`docs/foundation/principles.md`): libraries-over-services, lightweight, standard protocols, free-tier-friendly, svelte-native-first, no-codegen, speed-is-a-feature. The no-codegen constraint is consequential: Better Auth schema is hand-written Drizzle tables rather than auto-generated.

**Connects down to Layer 2** by providing the runtime these patterns run in. No Layer 2 code imports the vendor names directly; it imports from wrappers in `$lib/server/[domain]/`.

---

## Layer 2 — Architecture

Two architectural spines impose order on every request.

### Spine A — Composition Root

`src/hooks.server.ts` is the composition root. Three module-load side effects at the top of the file boot background work once at process start:

```
import '$lib/server/agents'
import '$lib/server/jobs/scheduler'
import '$lib/server/jobs/delivery-scheduler'
```

The main export is a `sequence()` of twelve `Handle` middlewares that mutate the shared `event.locals` bus in order. Each handler writes named fields and, in some cases, short-circuits the chain with a response before downstream handlers run.

| # | Handler | Writes to `event.locals` | Short-circuits? | Why this order |
|---|---------|--------------------------|-----------------|----------------|
| 1 | `securityHeaders` | `clientIp`; sets `x-client-ip` | No | Must be first — auth pins `ipAddressHeaders: ['x-client-ip']`; attacker-mutable headers are fixed here |
| 2 | `stripBaseLocalePrefix` | — | 308 on `/en/*` paths | Canonical URL before Paraglide resolves locale |
| 3 | `loadStyle` | `style`, `customPaletteColors`, `customPaletteAccentOffset` | No | Before i18n, which injects the palette `<style>` block |
| 4 | `i18n` (Paraglide) | `locale` | No | Wraps `resolve` with `transformPageChunk` to fill `%lang%/%palette%/%typography%/%radius%` and inject custom-palette CSS |
| 5 | `authCaptchaGate` | — | Decision response on captcha/rate-limit fail | Before `authHandler` — gate must run before Better Auth consumes the request body |
| 6 | `authHandler` | — | 429 on rate-limit exceed | Better Auth `svelteKitHandler` + Upstash rate-limit on `/api/auth/*` keyed by `clientIp` |
| 7 | `sessionPopulate` | `user`, `session`, `grants` | No | Must run AFTER `authHandler` (Better Auth #2188: `svelteKitHandler` does not populate locals). Fast-path skips DB if session cookie absent |
| 8 | `csrfProtection` | — | 403 on mutating `/api/*` without `X-Requested-With` or mismatched origin | Exempt: `/api/auth/`, `/api/cron/`, `/api/webhooks/`, `/api/analytics/journey` |
| 9 | `consentLoader` | `consentTier` (default `'necessary'`) | No | Before route handlers need consent tier |
| 10 | `debugOwnerLoader` | `debugOwnerId` | No | Verifies `v10r_debug_owner` HMAC cookie; fail-closed; independent of Better Auth |
| 11 | `devRouteGuard` | — | 404 on `(dev)` routes outside DEV | — |
| 12 | `analyticsCollector` | — | No | Last; consumes `consentTier` + `debugOwnerId`; fire-and-forget post-resolve |

The terminating error handler `handleError` mints an `errorId` (`crypto.randomUUID()`), emits one structured JSON log line, and returns `{ message, errorId }` to the client — never raw error details.

### Spine B — Hexagonal Multi-Client Core

All business logic lives in `$lib/server/[domain]/`. Thin **adapters** wrap it for each client type. The domain modules know nothing about the framework.

```
┌──────────────────────────────────────────────────────────────┐
│                          ADAPTERS                            │
│                                                              │
│  +page.server.ts   +server.ts   AI tools   jobs/  inngest/  │
│  (form actions,    (REST API,   (tool       (cron, (reactive │
│   load fns)         SSE)        wrappers)   sched.) events)  │
└──────┬───────────────┬───────────┬──────────┬────────┬───────┘
       │               │           │          │        │
       ▼               ▼           ▼          ▼        ▼
┌──────────────────────────────────────────────────────────────┐
│                      DOMAIN MODULES                          │
│                 $lib/server/[domain]/                         │
│                                                              │
│  notifications/    auth/         rawrag/      llmwiki/        │
│  ├── index.ts      ├── index.ts  ├── index.ts ├── search.ts  │
│  ├── service.ts    └── guards.ts └── ...      └── ...        │
│  └── ...                                                     │
│                                                              │
│  db/[domain]/                                                │
│  ├── queries.ts   (reads — no side effects)                  │
│  └── mutations.ts (writes — explicit intent)                 │
└──────────────────────────┬───────────────┬───────────────────┘
                           │               │
                           ▼               ▼
┌──────────────────────┐  ┌────────────────────────────────────┐
│  PostgreSQL           │  │  Neo4j  │  Redis  │  R2            │
│  (Drizzle ORM)       │  │  (graph)│ (cache) │  (storage)     │
└──────────────────────┘  └────────────────────────────────────┘
```

**The four invariants** — violations break cross-client reuse:

1. **No framework imports in domain modules.** No `@sveltejs/kit` or `$app/` imports inside `$lib/server/[domain]/`. These bind logic to the SvelteKit request cycle, preventing reuse by AI tools and jobs.
2. **Date serialization happens in the adapter layer.** Domain modules return `Date` objects as-is. The route or tool `execute` converts them to ISO strings.
3. **SvelteKit response helpers (`redirect`, `error`, `fail`, `message`) only in adapters.** Never in domain modules.
4. **Domains call down, not across.** Cross-domain reads go through the other domain's `index.ts` barrel only — never into its internals.

**Server/client boundary**: the `$lib/server/` path itself. SvelteKit refuses to bundle it client-side. No runtime guard is needed; the path is the boundary.

**Error spine**: `ServerError` base class (`src/lib/server/errors/index.ts`) with `kind` / `toStatus()` / `toJSON()`. Subclasses: `DbError` (maps PG SQLSTATE → safe message + HTTP status), `AIError`, `Neo4jError`, `LlmwikiError`. Each adapter translates: REST endpoints return `apiError(status, kind, safeMessage)`; AI stream tools return structured error objects (never throw); form actions use `fail()`; jobs capture into `JobResult`. Safe messages only — no PG codes, constraint names, or API-key prefixes reach the client.

---

## Layer 3 — Services / Applications

Route areas under `src/routes/[[locale=locale]]/` and the parallel `src/routes/api/` tree define the bounded contexts. Each context owns a route area, an API group, and primary server domains.

| Application | Route area | API group | Primary domain | Gate |
|-------------|-----------|-----------|---------------|------|
| Public + Showcases | `(public)/` (blog, docs, showcases, feedback) | — | — | None; self-documenting layer |
| Auth | `auth/` (login, verify) | `/api/auth/*` | `auth/` | ALTCHA-gated, rate-limited |
| App (member) | `app/` (dashboard, account, notifications, settings) | `/api/preferences/*`, `/api/notifications/*`, `/api/consent` | `preferences/`, `notifications/` | `app/+layout.server.ts` |
| Admin | `admin/` (access, ai, analytics, audit, branding, cache, content, db, feedback, flags, jobs, notifications, rag, users — ~14 areas) | `/api/admin/*` | various | `admin/+layout.server.ts` |
| Desk (AI workspace) | `desk/` | `/api/desk/*` (files, folders, spreadsheets, theme, workspaces) | `store/`, `branding/` | `desk/+layout.server.ts` |
| Blog | `(public)/blog/` | `/api/blog/*` (posts, comments, tags, assets, domains, folders, feed.xml) | `blog/`, `content/` | Capability-gated authoring |
| AI Assistant | — | `/api/ai/*` (chat, chat/stream, conversations, proposals, providers) | `ai/` | Session-gated |
| RAG / Retrieval | — | `/api/retrieval/*` (documents, graph, ingest, search, stats) | `rawrag/`, `llmwiki/`, `graph/` | Admin-gated |
| Notifications | — | `/api/notifications/*` (stream SSE, telegram, discord, read-all) | `notifications/` | Session-gated |
| Analytics | — | `/api/analytics/*` (journey beacon, stream) | `analytics/` | Consent-tiered |
| Pairing | `pair/[code]` | `/api/pair/*` | `pairing/` | HMAC cookie; independent of Better Auth |
| Jobs | — | `/api/cron/[job]` dispatcher | `jobs/` | Bearer token (Vercel cron) |
| Abuse | — | — | `abuse/` | Cross-cutting; wired in hooks |
| Visual identity | — | `/api/style/*`, `/api/desk/theme` | `branding/`, `styles/random/` | — |

**Self-documenting showcases**: pages under `(public)/showcases/` serve simultaneously as documentation, feature tests, and copy templates. If the showcase works, the feature is proven. This is the repo's primary test strategy for UI patterns.

---

## Layer 4 — Modules

`src/lib/server/[domain]/` holds ~31 server-side domain modules. `src/lib/[client-domain]/` holds client-side state, styles, i18n, schemas, and config. The public surface of every module is its `index.ts` **barrel export** — external callers import from the barrel only, never from internal files.

### Server-side domains (selected by file count)

| Domain | Files | Role |
|--------|-------|------|
| `db/` | 135 | Drizzle client + schema + all read/write query files |
| `ai/` | 35 | Provider registry, orchestrator, tools, errors, budget |
| `rawrag/` | 18 | Three-tier retrieval pipeline (tiers/, ingest/) |
| `notifications/` | 17 | Send, stream (SSE), route, outbox, channel providers |
| `blog/` | 16 | Posts, comments, tags, assets, feed |
| `llmwiki/` | 14 | Hybrid vector+BM25 wiki search, compile, lint |
| `jobs/` | 13 | Runner, scheduler, delivery-scheduler, 8 registered jobs |
| `store/` | 12 | Desk workspace and file data |
| `cache/` | 9 | Upstash Redis wrappers |
| `abuse/` | 9 | ALTCHA, honeypot, rate-limits, AI budget |

### Repeating module template

```
[domain]/
  index.ts           ← barrel / public API
  service.ts         ← multi-step orchestration (only when justified by ≥2 concrete consumers)
  queries.ts         ← reads; no side effects
  mutations.ts       ← writes; explicit intent
  types.ts
  config.ts
  errors.ts
  [feature].ts       ← one file per capability
  *.test.ts          ← co-located unit tests
  [sub-pipeline]/    ← e.g. rawrag/tiers/, rawrag/ingest/, ai/tools/, ai/loop/
```

Deviations: `auth/index.ts` is the Better Auth instance (construction site, not re-export). `ai/index.ts` exposes provider-resolver functions. Tiny modules (`utils/`, `errors/`, `schemas/`, `feedback/`) skip the full structure.

### The `db/` module — parallel-tree structure

`db/` is the most structurally important domain. It contains two co-located trees:

```
src/lib/server/db/
  index.ts                  ← Drizzle client over Neon serverless Pool
  errors.ts                 ← DbError, classifyDbError
  schema/
    [domain]/               ← what data IS (Drizzle table definitions)
    index.ts                ← re-exports every domain schema
    relations.ts            ← Drizzle relation definitions
  [domain]/
    queries.ts              ← how you read data
    mutations.ts            ← how you write data
```

`db/index.ts` exports the singleton `db` instance:

```typescript
neonConfig.poolQueryViaFetch = true; // Bun WebSocket workaround
const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema: { ...schema, ...relations } });
```

**Push-only workflow**: only `db:push` is used; no migrations directory exists. All `pgSchema()` and `pgEnum()` objects must be exported through `schema/index.ts` AND listed in `drizzle.config.ts` `schemaFilter` (12 namespaces: admin, showcase, auth, ai, rag, jobs, notifications, analytics, app, blog, desk, feedback) or `db:push` silently omits them.

### Client-side modules

| Module | Role |
|--------|------|
| `state/` | Svelte 5 runes stores (`*.svelte.ts`) |
| `styles/` | `tokens.ts` design tokens + `random/` procedural style engine |
| `i18n/` | Runtime locale wrapper |
| `paraglide/` | Generated message functions — do not edit |
| `schemas/` | Valibot schemas, foldered to mirror routes |
| `nav/`, `shortcuts/`, `config/` | App navigation, keyboard shortcuts, app config |

### Import direction

The import graph is a verified DAG. Cross-domain references always target barrel roots — never internals. The `db/` module imports no sibling domains; it is the sink. Framework coupling is confined to adapter-purpose files (`auth/guards.ts`, `api/response.ts`, `api/rate-limit.ts`, `abuse/decision.ts`) and scheduler-boot code that reads the `building` / `dev` flags. Pure domain modules — `db/`, `rawrag/`, `blog/`, `store/`, `llmwiki/`, `ai/providers` — have zero framework imports.

---

## Layer 5 — Components

`src/lib/components/[layer]/` organizes 22 categories in a dependency-direction hierarchy.

### Layer order (leaf → root)

```
primitives/     wrap Bits UI: button, dialog, table, slider, combobox,
                tabs, typography, switch, popover, calendar, …

composites/     compose primitives: card, form-field, command-palette,
                dropdown-menu, pagination, toast, confirm-dialog, dock,
                chatbot, page-header, empty-state, …

layout/         Stack, Cluster, PageContainer

shell/          app chrome: AppShell, Sidebar*, Nav*, UserMenu,
                ConsentBanner — depend on composites/primitives/layout

feature dirs/   blog, chat, editor, explorer, spreadsheet, viz, cycle,
                io-log, branding, 3d, docs, ui, preview, admin —
                depend DOWNWARD on composites/primitives/layout; never
                on each other
```

### Public barrel (`src/lib/components/index.ts`)

```typescript
export * from './composites';
export * from './layout';
export * from './primitives';

// viz/ excluded — import from '$lib/components/viz' directly
//   (avoids bundling Chart.js/Three.js into the default surface)
// shell/ excluded — app-specific chrome, import from '$lib/components/shell'
```

`viz/` and `shell/` are intentionally excluded from the default barrel. This is a bundle-size boundary: Chart.js, Three.js, and app-specific chrome should not load on every page.

### Design tokens

- `src/app.css` — runtime CSS custom properties (`:root` light, `.dark` dark). All color tokens live here.
- `src/lib/styles/tokens.ts` — build-time token values (breakpoints, fontSize, spacing, borderRadius, zIndex, iconSize) read by `uno.config.ts`.

**Component-First Rule**: never use a raw HTML element (`<button>`, `<input>`, `<select>`, `<textarea>`) when a project component exists. Raw elements bypass the design system. Exceptions: `<input type="hidden">`, `<input type="checkbox">` in table rows for native indeterminate support, `<select>` binding numeric values, and custom interactive regions needing specialized styling.

---

## Layer 6 — Classes / Functions

Individual files inside a module or component folder. Private by default; public only when re-exported from the folder's `index.ts`.

### Recurring kinds

**Guards** (`auth/guards.ts`):

| Function | Failure |
|----------|---------|
| `requireAuth(locals)` | `redirect(303, '/auth/login')` |
| `requireApiUser(locals)` | `error(401)` |
| `requireAdmin(locals)` | `error(404, 'Not Found')` — non-admins get a 404, not a 403, so the admin surface is not disclosed |

**Services** — multi-step orchestration warranting extraction: `NotificationService.send()` (DB insert → SSE push → async channel routing).

**Domain functions** — the shared call site for all adapters: `getNotifications`, `markAsRead`, `retrieve` (rawrag), `searchLlmwiki`, `getCustomPaletteById`.

**Read/write seam**: `queries.ts` contains reads with no side effects; `mutations.ts` contains writes with explicit intent. This split is a naming convention, not a CQRS infrastructure.

**Error classes and classifiers**: `ServerError` → `DbError` / `AIError` / `Neo4jError` / `LlmwikiError`; `classifyDbError` / `classifyAIError` / `classifyNeo4jError`; `safeDbMessage` / `safeAIMessage`.

**Provider resolution** (`ai/providers.ts`): `getActiveProvider` / `getToolProvider` resolves in order: request override → user preference → env → first configured. Circuit breaker: `markCooldown` / `isCooledDown` (60-second window), Redis-backed (`ai:cooldown:{id}`) so it is cross-instance and async.

**AI tools** (`ai/tools/`): `desk-read`, `desk-write`, `propose-plan`, `get-rawrag-chunks`, `get-llmwiki-pages`, `resolve-ref`, `search-catalog`, `search-docs`. All are thin wrappers that return structured data and never throw — tools return error objects; the LLM reads them.

**Catalog grounding** (`ai/catalog-citations.ts`, `ai/tool-leak-guard.ts`): post-stream surface-citation verifier and Groq/llama textual-tool-call leak guard. See [blueprint/ai/provider-routing.md](./blueprint/ai/provider-routing.md).

**Catalog graph** (`search/catalog-map.ts`, `search/catalog-projection.ts`, `graph/catalog.ts`): `formatCatalogMap` injects a path-free shape hint into the system prompt; `deriveCatalogGraph` projects the showcase registry to typed `:Resource` nodes + `PART_OF` edges; `seedCatalogResources` writes them to Neo4j idempotently (run via `db:catalog-sync`, chained into `db:setup`).

**Docs corpus** (`rawrag/markdown-split.ts`, `ai/tools/search-docs.ts`, `scripts/db/ingest-docs.ts`): the project's own `docs/**/*.md` is ingested into `rag.document`/`rag.chunk` (owned by `SYSTEM_DOCS_USER_ID`) so the `search_project_docs` tool can ground "how does X work" answers in the real docs. Ingestion is **manual** — `db:ingest-docs` (not chained into `db:setup`). See [blueprint/ai/layered-rag.md](./blueprint/ai/layered-rag.md#docs-corpus-search_project_docs).

**CVA variant definitions** (e.g. `button.ts`): class-variance-authority variants double as DOM markers for scoped CSS selectors (UnoCSS cannot extract complex classes from `.ts` files reliably; `Button.svelte` scoped CSS does the actual styling, targeting CVA class names as `:global()` selectors).

---

## Layer 7 — Code

Leaf `.ts`, `.svelte`, and `.css` files. The execution substrate.

**Languages and type discipline**: TypeScript strict mode throughout. Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) for all reactive state — no Svelte 4 stores. CSS custom properties for all theming.

**Recurring idioms**:

| Idiom | Pattern |
|-------|---------|
| Framework-free domains | Domain functions take plain arguments; return plain values or `null` |
| Return-null-not-throw at domain boundaries | `return row ?? null` rather than `error(404)` inside domain logic |
| Structured tool returns | `return { data }` or `return { error: 'safe message' }` — never throw from a tool |
| Fire-and-forget side effects | `someAsyncWork().catch(logger)` — not awaited, not blocking |
| OKLCH color math | `culori` library for accent token derivation |
| Graph queries | Cypher via Neo4j driver (Bolt) |
| Type-safe SQL | Drizzle ORM; schema-typed queries |
| Form validation | Valibot `safeParse`; Superforms lifecycle stays in the adapter |

---

## Data Flow & Wiring (Runtime)

### Descent diagram

```
HTTP edge
  │
  ▼
hooks.server.ts  sequence()  ──────────────────────────────────────────┐
  │  (12 stages, mutate event.locals)                                  │
  │  [securityHeaders → stripBaseLocalePrefix → loadStyle → i18n →     │
  │   authCaptchaGate → authHandler → sessionPopulate →                │
  │   csrfProtection → consentLoader → debugOwnerLoader →              │
  │   devRouteGuard → analyticsCollector]                              │
  │                                                                    │
  ▼                                                                    │
Route adapter  (event.locals fully populated)                          │
  │  +page.server.ts  |  +server.ts  |  ai/tools/  |  jobs/           │
  │                                                                    │
  ▼                                                                    │
Domain module  $lib/server/[domain]/  (no framework imports)           │
  │  Pure TypeScript; calls db/, calls infra via injected clients      │
  │                                                                    │
  ▼                                                                    │
db/[domain]/{queries,mutations}.ts                                     │
  │                                                                    │
  ▼                                                                    │
Infra boundary ───────────────────────────────────────────────────────┘
  Postgres/Neon · Neo4j/Aura · Upstash Redis · R2 · AI providers · channels
```

Data flows down. Responses bubble up the same chain. The `event.locals` bus is the handoff between the middleware column and the route-adapter column.

### Infra boundary crossings

| Infrastructure | Used by |
|---------------|---------|
| PostgreSQL / Neon | All CRUD; RAG tiers 1–2; llmwiki search; analytics; job logs; grants; conversations |
| Neo4j / Aura (Bolt) | RAG tier-3 graph expansion only |
| Upstash Redis | Rate-limit; AI daily budget; Better Auth secondary storage |
| Cloudflare R2 (S3 API) | Blog media, avatars |
| AI providers (HTTPS) | Embeddings + `streamText` |
| Notification channels | Telegram, Discord, SMTP (external delivery) |
| In-process SSE Map | In-app push — server→client; lives in persistent process heap; does not survive restart or cross instances |

### Multi-client adapter table

| Client | Adapter | Domain call | Infrastructure |
|--------|---------|-------------|---------------|
| Human UI | `+page.server.ts` load / action | `getNotifications()` | PostgreSQL |
| REST API | `+server.ts` GET / POST | `markAsRead()` | PostgreSQL |
| AI tool | tool `execute` callback | `getNotifications()` | PostgreSQL |
| Background job | `runJob()` → job function | Direct DB call | PostgreSQL |
| Reactive workflow | Inngest `step.run()` | `NotificationService.send()` | PostgreSQL |

Authentication per client: session cookie for UI and REST (populated by `sessionPopulate` in hooks); closure capture of `userId` for AI tools (auth happens once at the chat endpoint, `user.id` flows into `createTools(user.id)`); none for background jobs (trusted server context); Inngest signing key for reactive workflows.

### Traced flows (wiring inventory)

Eight end-to-end flows have been traced through the system:

1. **Request lifecycle** — HTTP edge → hooks pipeline → route adapter → domain → DB → response
2. **Multi-client core** (notifications) — same `getNotifications` / `markAsRead` called from UI, REST, AI tool, and job
3. **AI chat + tool-calling** — `orchestrateChat` in `ai/chat-orchestrator.ts`; provider resolution → `streamText` → tool loop → persistence
4. **RAG retrieval** — `retrieve` in `rawrag/index.ts` fans out across `tiers/` (tier-1 `searchContextual` = pgvector + BM25 fused via reciprocal-rank fusion, tier-2 `searchParentChild`, tier-3 `searchGraph` — Postgres seeds → Neo4j expand → Postgres hydrate)
5. **Notification delivery** — `NotificationService.send()` → DB insert + SSE push (synchronous) + channel routing (async: Telegram / Discord / email)
6. **Background jobs** — `runJob()` + scheduler (`setInterval`, persistent container) vs cron dispatcher (`/api/cron/[job]`, serverless); same runner, different trigger
7. **Visual identity** — `loadStyle` in hooks resolves cookie → brand override → custom palette DB lookup → `generateRandomStyle` fallback; Paraglide `transformPageChunk` injects palette CSS into every HTML response
8. **Auth + session + grants + analytics** — `authHandler` (Better Auth) → `sessionPopulate` (locals.user/session/grants) → `analyticsCollector` (consent-tiered, fire-and-forget)

---

## Drift from Blueprint & Known Gaps

These gaps make the blueprint-to-code mapping imperfect. They are recorded here, not concealed, so the doc remains trustworthy.

1. **No notification AI tool implemented.** `multi-client-core.md` uses `createNotificationTools` / `markNotificationRead` as its flagship example. `ai/tools/` currently holds desk, llmwiki, rawrag, propose-plan, and resolve-ref tools. Multi-client reuse for notifications is real for UI, REST, and jobs — not yet for AI.

2. **`checkUserBudget` is dead code.** `chargeTokens` records daily AI spend to Redis in `onFinish`, but the entry-gate `checkUserBudget` in `ai/budget.ts` is called nowhere. The daily token cap is recorded but never enforced.

3. **`notification-delivery` has no serverless trigger.** It runs only via the persistent-container `delivery-scheduler` (15-second `setInterval`). It is absent from the jobs registry and has no `/api/cron/[job]` path. On Vercel (`platform.persistent === false`) external Telegram / Discord / email deliveries queue as `pending` and never drain. In-app SSE still works because it is synchronous inside `NotificationService.send()`.

4. **Two divergent chat surfaces.** `/api/ai/chat` runs the full orchestrator (routing, retrieval, tools, persistence). `/api/ai/chat/stream` is a bare `streamText` with no tools, retrieval, or persistence — a parallel minimal path.

5. **Blueprint examples lag the SDK.** `multi-client-core.md` shows AI SDK v4/v5 spellings (`parameters`, `maxSteps`, `maxTokens`). The running code is v6 (`inputSchema`, `stopWhen: stepCountIs`, `maxOutputTokens`). The code is correct; the blueprint doc has not been updated.

---

## Related Docs

| Document | What it elaborates |
|----------|--------------------|
| [`codebase-organization.md`](./codebase-organization.md) | The spatial map: source-tree layout, canonical-home rules, import direction |
| [`blueprint/architecture/multi-client-core.md`](./blueprint/architecture/multi-client-core.md) | Full hexagonal core pattern: the four invariants, adapter patterns, auth per client type, error handling, extraction rules |
| [`blueprint/middleware.md`](./blueprint/middleware.md) | Hooks pipeline detail: CORS, security headers, session strategy |
| [`blueprint/ai/`](./blueprint/ai/) | AI assistant architecture, RAG pipeline, TOON format, tool design |
| [`blueprint/db/polyglot-freshness.md`](./blueprint/db/polyglot-freshness.md) | When to use each data store; freshness and consistency tradeoffs |
| [`foundation/architecture.md`](./foundation/architecture.md) | SvelteKit route structure patterns |
| [`foundation/principles.md`](./foundation/principles.md) | The seven decision constraints that drive every stack choice |
