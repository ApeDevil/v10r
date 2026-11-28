# Slice 1 — Benchmark baseline and truthful infrastructure facts

Implemented 2026-11-28 on `claude/cloud/pattern-ontology-engineering`, following ApeDevil's rulings of the same
day ([decision register](./decision-register.md)). Stopped at the Slice 1 review checkpoint: **review the needs
diff per record and the benchmark delta**. Slice 2 does not start without ApeDevil's word.

## What changed, and why

| # | Change | Why (ruling) |
|---|---|---|
| 1 | Composition benchmark: 8 design + 10 holdout scenarios, run through the real `recommend_emulation_plan`; baseline committed (`45d883b`) **before** any registry change | Verification must measure semantics, not only pass the gate (D-01, D-16; F27). The holdouts check that a fix generalizes rather than fitting the eight scenarios it was designed on |
| 2 | `requires` → `needs`; `PATTERN_REQUIREMENTS` → `INFRASTRUCTURE_NEEDS` (13 capability-level needs, each with its binding and the technologies that provide it) | A need names a capability, not v10r's technology. No technology is mandatory because v10r uses it (D-06; F06) |
| 3 | Four need levels: `required`, `conditional` (with `when`), `optional` (with `why`), `implementation` (with `why`); a `pinned` technology only with a reason | Required, conditional, optional and implementation-specific are different promises to the adopter (D-06). Optional and implementation needs are never inherited, so optional never becomes mandatory transitively (relationship rulings) |
| 4 | Adoption needs inherit `required` and `conditional` through `depends_on`; the strictest level wins; each inherited need names the record it comes from (`via`) | Every plan fact has a traceable reason; shared needs are deduplicated |
| 5 | `target_infra` accepts need ids and technologies; a technology implies its need; a pinned need accepts only its technology | A target project describes itself in its own words; the planner settles the mapping |
| 6 | Needs curated on all 199 records; gate: every infrastructure adapter a record's code imports directly must be declared at some level | "No infrastructure" was false for most light records (F02). Claims must match enforcement (D-12) |
| 7 | Gate: every Architecture Engineering node-kind need is declared by one of that kind's patterns | Two vocabularies said different things about the same nodes (F05, F21) |
| 8 | Canonical titles; gate on numerals, version references and parentheses in titles (allow-list) | Titles name concepts; counts and versions drift (D-09; F17) |
| 9 | Registry `version` string → `format` integer + computed content digest (`registry-digest.ts`); benchmark, skills and tool metadata carry the digest | A hand-bumped version string said nothing reliable about the content (F18) |
| 10 | `ai-agent-actions` no longer depends on `desk-workspace`; the Desk knowledge stays in its code refs | D-14: drop Desk edges now; renames wait for the Desk refactor (F30) |
| 11 | `docs/naming.md`: infrastructure need, need level, pin, technology, registry digest, registry format | One name, one concept |

Not in this slice, on purpose: step selection (deep-only rule, runner-up rule) and edge semantics. They change in
Slices 3–4 and are measured against this baseline, so the step metrics below are expected to be unchanged.

## Implementation map

| Where | What |
|---|---|
| `pattern-library/schema.ts` | `INFRASTRUCTURE_NEEDS`, `NEED_LEVELS`, `NeedEntry`, `validateNeeds`, `REGISTRY_FORMAT = 3`, title rules |
| `pattern-library/infrastructure-needs.ts` | `adoptionNeeds` (inheritance), `needLabel`, `needsSummary`, `targetProvides` — the one implementation every reader uses |
| `pattern-library/infrastructure-evidence.ts` | Direct-import scan, adapter map, `SURVEY_REFS` exemptions with reasons |
| `pattern-library/registry-digest.ts` | Content digest |
| `pattern-library/validate.ts` | Needs-evidence gate, node-kind gate, title gate |
| `pattern-library/query.ts` | Card, rows, step verdicts and the plan's infrastructure section print needs by level |
| `dependency-explorer.ts`, MCP Apps explorer view, docs pages (`render.ts`), Agent Skills, Vely `search_pattern_library`, `server-info` | Same needs text, digest instead of version |
| `src/lib/architecture-engineering/vocabulary.ts`, `compare.ts`, Studio engineer page | Node-kind `requires` → `needs` in the need vocabulary |
| `scripts/patterns/composition-bench.ts`, `pattern-library/bench/composition-*.json` | `bun run patterns:bench [--write F] [--compare F]` |

### The import-scan gate, precisely

It reads the files of a record's `file`/`dir` code refs (tests excluded), takes their **direct** value imports
(`import type` ignored), and maps each one that resolves to an infrastructure adapter (database layer, graph
client, cache tiers, object store, AI providers, email senders, WASM modules) or to a platform-API signal in
code, not comments (`new Worker(`, `navigator.serviceWorker`, `cosineDistance(`) to a need. The record must
declare that need at some level. Direct imports only: following barrels attributed a whole domain's
infrastructure to anything that imports one function from it. `scheduler`, `external-api` and `container-host`
have no reliable import signal and stay curated. Five survey refs (records that cite a whole layer to show
where things live) are exempt, each with its reason in code.

Result: 0 undeclared adapter imports across 199 records (seven declarations were added after the gate's first
run found them).

## Needs, per record

106 records changed. Level counts after the slice: 106 required, 30 conditional, 1 optional, 36 implementation;
92 records declare no infrastructure (before: 176 declared none, 23 declared some).

<details><summary>Needs manifest (106 rows)</summary>

| id | before (`requires`) | after (`needs`; level when not required) |
|---|---|---|
| `architecture-rest-api` | — | key-value-store (implementation) |
| `architecture-state-management` | — | llm-provider (implementation) |
| `architecture-request-cycle-visualizer` | — | llm-provider (implementation), relational-db (implementation) |
| `architecture-testing-infra` | — | relational-db (implementation) |
| `architecture-hosted-mcp` | — | key-value-store, relational-db (implementation) |
| `architecture-mcp-authorization` | — | relational-db, email-delivery (implementation) |
| `architecture-wasm-kernel` | — | wasm-toolchain, container-host (conditional) |
| `app-shell-sidebar` | — | service-worker (implementation) |
| `app-shell-style-randomizer` | — | relational-db (implementation) |
| `app-shell-quick-search` | — | relational-db (implementation) |
| `forms-file-uploads` | — | object-storage, relational-db (implementation) |
| `i18n-db-content` | — | relational-db |
| `databases-postgres-connection` | — | relational-db (pinned postgres) |
| `databases-schema-type-inference` | — | relational-db, vector-search (implementation) |
| `databases-queries-mutations-split` | — | relational-db, vector-search (implementation) |
| `databases-neo4j-connection` | — | graph-db (pinned neo4j) |
| `databases-graph-modeling` | — | graph-db |
| `databases-graph-traversal` | — | graph-db |
| `databases-polyglot-freshness` | — | relational-db, graph-db |
| `databases-object-storage` | — | object-storage, relational-db (implementation) |
| `databases-cache` | — | key-value-store (pinned redis) |
| `temporal-data-modeling` | — | relational-db, vector-search (implementation) |
| `db-ops-dev-prod-schema-workflow` | — | relational-db |
| `db-ops-branch-refresh` | — | relational-db (pinned postgres), external-api (conditional) |
| `db-ops-bootstrap-seed` | — | relational-db, graph-db (conditional), llm-provider (conditional) |
| `identity-passwordless-auth` | — | relational-db, email-delivery |
| `identity-oauth` | — | relational-db, external-api, email-delivery (implementation), key-value-store (conditional) |
| `identity-capability-grants` | — | relational-db, scheduler (conditional) |
| `identity-passkeys` | — | relational-db, email-delivery (implementation), key-value-store (conditional) |
| `identity-user-management` | — | relational-db |
| `anti-abuse-captcha` | — | key-value-store (conditional) |
| `anti-abuse-rate-limiting` | — | key-value-store |
| `anti-abuse-ai-budget` | — | key-value-store, llm-provider |
| `admin-privacy-admin-area` | — | relational-db |
| `admin-privacy-gdpr` | — | relational-db, object-storage (conditional), graph-db (conditional) |
| `admin-privacy-data-retention` | — | relational-db, scheduler, object-storage (conditional) |
| `admin-privacy-pairing` | — | relational-db |
| `admin-privacy-style-picking` | — | relational-db (implementation) |
| `admin-privacy-audit-log` | — | relational-db |
| `admin-privacy-feedback` | — | relational-db |
| `ai-tool-harness` | ai-provider | llm-provider |
| `ai-surfaces` | ai-provider | llm-provider, relational-db (conditional) |
| `deskbot-approval-gate` | postgres, ai-provider | relational-db, llm-provider |
| `layered-rag` | postgres, pgvector, ai-provider | relational-db, vector-search, llm-provider, graph-db (conditional) |
| `retrieval-endpoints` | postgres, pgvector, ai-provider | relational-db, vector-search, llm-provider |
| `ai-chat-assistant` | — | llm-provider, relational-db (conditional) |
| `ai-chatbot-session` | — | llm-provider |
| `ai-provider-routing` | — | llm-provider |
| `ai-site-awareness` | — | llm-provider |
| `ai-graph-rag` | — | graph-db, vector-search, relational-db, llm-provider |
| `ai-turn-trace` | — | relational-db |
| `ai-image-metadata` | — | llm-provider, object-storage, relational-db |
| `ai-deskbot` | — | llm-provider, relational-db |
| `toolkits-image-kit` | — | llm-provider, object-storage |
| `analytics-pageview-hook` | — | relational-db |
| `analytics-journeys` | — | relational-db |
| `analytics-funnels` | — | relational-db |
| `analytics-live-feed` | — | relational-db, key-value-store (conditional) |
| `analytics-rollup-cleanup` | — | relational-db, scheduler |
| `analytics-my-data-transparency` | — | relational-db, key-value-store (implementation) |
| `notifications-router-outbox` | — | relational-db, scheduler (conditional) |
| `notifications-channels` | — | relational-db, email-delivery (conditional), external-api (conditional) |
| `notifications-sse-stream` | — | relational-db, key-value-store (conditional) |
| `notifications-settings-matrix` | — | relational-db |
| `notifications-schema-delivery-log` | — | relational-db |
| `jobs-scheduler` | postgres | relational-db, scheduler |
| `jobs-platform-scheduling` | — | scheduler |
| `jobs-registered-catalog` | — | scheduler, relational-db (implementation), object-storage (implementation) |
| `pwa-service-worker` | — | service-worker |
| `pwa-update-flow` | — | service-worker |
| `pwa-web-push` | — | service-worker, relational-db, email-delivery (implementation) |
| `viz-maps` | — | external-api (conditional) |
| `agentic-parametric-modeling` | web-worker | web-worker (conditional) |
| `content-blog-engine` | — | relational-db, object-storage (conditional) |
| `content-comments` | — | relational-db |
| `content-markdown-pipeline` | — | object-storage (implementation), relational-db (implementation) |
| `desk-workspace` | — | relational-db |
| `hierarchical-cache` | redis | key-value-store (conditional) |
| `stale-while-revalidate` | — | key-value-store (conditional) |
| `singleflight` | — | key-value-store (conditional) |
| `no-waterfall-loading` | — | relational-db (implementation), key-value-store (implementation) |
| `velocity-screen-read-model` | — | relational-db |
| `query-budget` | postgres | relational-db |
| `critical-path-deferred-tail` | — | relational-db (implementation) |
| `main-thread-budget` | web-worker | web-worker, wasm-toolchain (optional) |
| `resilience-policy` | — | key-value-store (conditional) |
| `velocity-asset-delivery` | — | object-storage (conditional) |
| `deadline-propagation` | — | relational-db (implementation) |
| `latency-tracing` | — | relational-db (implementation) |
| `scenario-harness` | — | key-value-store (implementation) |
| `name-check` | postgres, third-party-api | external-api, key-value-store (conditional), relational-db (conditional) |
| `source-of-truth-gate` | — | relational-db (implementation), llm-provider (implementation) |
| `derivation-key` | postgres | relational-db (conditional), llm-provider (implementation) |
| `provenance-record` | postgres | relational-db, vector-search (implementation) |
| `durable-step-execution` | postgres | relational-db |
| `versioned-document-session` | postgres | relational-db |
| `dynamic-attributes` | — | relational-db (implementation) |
| `encryption-key-ring` | postgres, cron | relational-db, scheduler |
| `ai-untrusted-content-boundary` | ai-provider | llm-provider |
| `ai-agent-actions` | ai-provider | llm-provider |
| `ai-mcp-client` | third-party-api | llm-provider, external-api, relational-db |
| `ai-agent-to-agent` | — | relational-db, external-api |
| `ai-generative-ui` | ai-provider | llm-provider, relational-db (implementation) |
| `ai-agent-user-interaction` | — | llm-provider |
| `ai-eval-regression-suite` | ai-provider, postgres | llm-provider |
| `pim-sheet-transform-recipe` | ai-provider | llm-provider |

</details>

## Titles

145 titles changed. Parenthetical details and counts moved to `keywords` where they carry search value, so
nothing a search found before is lost. Allow-listed numerals: `N+1`, `3D`, `OAuth 2.1`, `A2A`, `A2UI`, `S3`,
`i18n`, `Neo4j`. Summaries that stated counts were rewritten (`pattern-index`, `databases-schema-type-inference`,
`analytics-pageview-hook`). Ids are untouched: the identifier review is Slice 2 (D-10).

<details><summary>Title manifest (145 rows)</summary>

| id | old title | new title | terms moved to keywords |
|---|---|---|---|
| `multi-client-core` | Multi-client core (hexagonal domain modules) | Multi-client core | hexagonal domain modules |
| `architecture-runtime-layers` | Runtime layers & request flow (7-layer view) | Runtime layers and request flow | — |
| `architecture-codebase-map` | Codebase map ("where does X live") | Codebase map | where does x live |
| `architecture-middleware` | Middleware / 14-stage hook chain (CSRF, headers, guards) | Middleware hook chain | headers; guards |
| `architecture-rest-api` | REST API patterns (pagination, envelopes, rate limits) | REST API patterns | envelopes |
| `architecture-error-handling` | Error handling (expected/unexpected/form/API) | Error handling | expected/unexpected/form/api |
| `architecture-state-management` | State management (Svelte 5 runes) | State management | — |
| `architecture-request-cycle-visualizer` | Request-cycle visualizer (form · API · AI) | Request-cycle visualizer | form; api |
| `architecture-deployment` | Deployment (Vercel serverless, container target planned) | Deployment | vercel serverless |
| `architecture-testing-infra` | Testing infrastructure (Vitest, PGlite isolation) | Testing infrastructure | pglite isolation |
| `architecture-pattern-mcp` | Pattern MCP (agent-queryable pattern registry, local stdio) | Pattern MCP | agent-queryable pattern registry; local stdio |
| `architecture-hosted-mcp` | Hosted MCP (four trust surfaces: public · private · admin · admin page) | Hosted MCP | — |
| `architecture-mcp-evolution` | MCP protocol evolution (official SDK, dual-era serving, conformance lane, evidence-gated adoption) | MCP protocol evolution | official sdk; dual-era serving; conformance lane; evidence-gated adoption |
| `architecture-mcp-authorization` | Authenticated MCP services (OAuth 2.1 protected resources on Better Auth) | Authenticated MCP services | oauth 2.1 protected resources on better auth |
| `architecture-agentic-architecture` | Agentic architecture (one application architecture, optional interoperability doors) | Agentic architecture | one application architecture; optional interoperability doors |
| `architecture-wasm-kernel` | Rust→wasm compute kernel (vendored, plugin-free) | WebAssembly compute kernel | vendored; plugin-free |
| `architecture-external-service` | External service runtime (a separately deployed backend behind a typed client) | External service runtime | separately deployed backend behind a typed client |
| `architecture-engineering` | Architecture Engineering (explained decision records, a typed architecture model and static checks) | Architecture Engineering | explained decision records; typed architecture model and static checks |
| `app-shell-layout` | Shell layout (no global header, sidebar-first) | Shell layout | no global header; sidebar-first |
| `app-shell-sidebar` | Responsive sidebar (rail / drawer / FAB) | Responsive sidebar | rail / drawer / fab |
| `app-shell-toasts` | Toasts (stacking, undo) | Toasts | stacking |
| `app-shell-session-lifecycle` | Session lifecycle UI (expiry, re-auth) | Session lifecycle UI | — |
| `app-shell-settings` | Settings (theme cookie, language, a11y) | Settings page | language |
| `app-shell-style-randomizer` | Style randomizer (theme × typography × palette) | Style randomizer | theme × typography × palette |
| `app-shell-loading-states` | Loading states (skeletons, nav progress) | Loading states | skeletons; nav progress |
| `app-shell-page-header` | Page header (per-page, XSS-safe) | Page header | — |
| `app-shell-quick-search` | Quick Search / command palette (two-lane FTS) | Quick search command palette | two-lane fts |
| `ui-component-system` | Component-first UI system (primitives/composites/layout, CVA, tokens) | Component-first UI system | primitives/composites/layout |
| `ui-design-tokens` | Design tokens (breakpoints, fluid type/space, z-index) | Design tokens | fluid type/space |
| `ui-tonal-elevation` | Tonal (surface) elevation engine | Tonal elevation engine | — |
| `ui-primitives` | Primitives (~40 Bits UI wrappers) | UI primitives | — |
| `ui-layout-primitives` | Layout primitives (Stack, Cluster, Surface) | Layout primitives | — |
| `ui-fluid-styling` | Fluid responsive styling (UnoCSS, container queries) | Fluid responsive styling | — |
| `ui-menus` | Menus (dropdown, context, menu bar) | Menus | context |
| `ui-split-panes` | Split panes (resizable · reorderable) | Split panes | — |
| `ui-decorative` | Decorative (ornaments · backgrounds) | Decorative ornaments and backgrounds | — |
| `forms-basic-forms` | Basic forms (contact · settings) | Basic forms | contact; settings |
| `forms-validation-timing` | Validation timing (realtime · async · server) | Validation timing | server |
| `forms-multi-step-dynamic` | Multi-step & dynamic (wizard · dynamic · dependent) | Multi-step and dynamic forms | dynamic; dependent |
| `forms-advanced-patterns` | Advanced (confirm · reset · edit) | Advanced form tactics | confirm; reset; edit |
| `forms-auth-forms` | Auth forms (Better Auth client, not Superforms) | Auth forms | better auth client; not superforms |
| `forms-file-uploads` | File uploads (withFiles + Sharp + R2) | File uploads | withfiles |
| `i18n-locale-routing` | Locale routing (optional catch-all, matcher, 308 canonical) | Locale routing | optional catch-all; matcher; 308 canonical |
| `i18n-messages` | Messages (Paraglide JS, ICU, compile-time) | Translated messages | paraglide js; compile-time |
| `i18n-db-content` | DB content i18n (JSONB sidecar + `tc()`) | Translated database content | — |
| `docs-nav-hubs` | Docs navigation hubs (README-per-directory convention) | Docs navigation hubs | readme-per-directory convention |
| `pattern-index` | Pattern Index (the generated README capability map) | Pattern Index | generated readme capability map |
| `agent-experience` | Agent Experience (AX) surfaces | Agent experience surfaces | — |
| `resource-anchor-integrity` | Resource anchor integrity (fragments and routing paths resolve) | Resource anchor integrity | fragments and routing paths resolve |
| `databases-postgres-connection` | Postgres client & connection (Neon serverless) | Postgres client and connection | neon serverless |
| `databases-schema-type-inference` | Schema & type inference (Drizzle, 14 namespaces) | Schema and type inference | — |
| `databases-queries-mutations-split` | Queries/mutations split (reads-writes duality) | Queries/mutations split | reads-writes duality |
| `databases-neo4j-connection` | Neo4j connection (Aura) | Neo4j connection | — |
| `databases-polyglot-freshness` | Polyglot freshness (Postgres ↔ Neo4j sync) | Polyglot freshness | — |
| `databases-object-storage` | Object storage (Cloudflare R2, presigned transfer) | Object storage | presigned transfer |
| `databases-cache` | Cache (Upstash Redis, ephemeral patterns) | Redis cache client | upstash redis; ephemeral patterns |
| `temporal-data-modeling` | Temporal data modeling (how much time to store) | Temporal data modeling | how much time to store |
| `db-ops-dev-prod-schema-workflow` | Dev→prod schema workflow (push-only, no migrations dir) | Dev-to-prod schema workflow | push-only; no migrations dir |
| `db-ops-branch-refresh` | Neon branch refresh from prod (control plane, run ledger) | Neon branch refresh from prod | run ledger |
| `identity-passwordless-auth` | Passwordless auth (magic link + OTP) | Passwordless auth | — |
| `identity-oauth` | OAuth (GitHub, Google) | OAuth | — |
| `identity-capability-grants` | Capability grants (request → approve → expire) | Capability grants | request → approve → expire |
| `anti-abuse-honeypot` | Honeypot (hidden field + min fill time) | Honeypot | hidden field; min fill time |
| `anti-abuse-rate-limiting` | Rate limiting (sliding window, fail-closed) | Rate limiting | — |
| `admin-privacy-gdpr` | GDPR data transparency (view · export · delete) | GDPR data transparency | view; delete |
| `admin-privacy-pairing` | Cross-device debug pairing (QR + HMAC cookie) | Cross-device debug pairing | — |
| `ai-tool-harness` | AI tool manifest & harness split (tool defs, risk metadata, registry) | AI tool manifest and harness split | tool defs; risk metadata; registry |
| `ai-surfaces` | AI surfaces (chatbot vs deskbot split over one guard) | AI surfaces | deskbot split over one guard |
| `deskbot-approval-gate` | Deskbot approval gate (proposal → approve, plan-gated mutation) | Deskbot approval gate | proposal → approve; plan-gated mutation |
| `retrieval-endpoints` | Retrieval ingest/search endpoints (one ingest door, /api/retrieval/*) | Retrieval ingest/search endpoints | one ingest door; /api/retrieval/* |
| `ai-chat-assistant` | Chat assistant "Vely" (orchestrator, streaming) | Chat assistant | — |
| `ai-provider-routing` | Provider registry & routing (chat/tools/vision + circuit breaker) | Provider registry & routing | chat/tools/vision |
| `ai-site-awareness` | Chatbot site awareness (page context) | Chatbot site awareness | — |
| `ai-graph-rag` | Graph RAG pipeline (three tiers, RRF fusion) | Graph RAG pipeline | three tiers |
| `ai-turn-trace` | Turn trace (recorded account of every AI turn) + turn graph | Turn trace and turn graph | — |
| `ai-image-metadata` | Image metadata reader (vision) | Image metadata reader | — |
| `ai-deskbot` | Deskbot (AI in the desk workspace) | Deskbot | ai in the desk workspace |
| `ai-harness-lens` | Agent-harness audit lens (loop/context/policy/tools) | Agent-harness audit lens | loop/context/policy/tools |
| `toolkits-image-kit` | Image Kit (upload → AI pipeline → adjust → approve, persists nothing) | Image Kit | upload → ai pipeline → adjust → approve; persists nothing |
| `analytics-pageview-hook` | Pageview collector hook (last of 14 middleware stages) | Pageview collector hook | — |
| `analytics-consent-sessions` | Consent-gated sessions (cookieless day-rotating id) | Consent-gated sessions | cookieless day-rotating id |
| `analytics-journeys` | User journeys (client beacon) | User journeys | client beacon |
| `notifications-router-outbox` | Router, outbox & delivery worker | Notification router, outbox and delivery worker | — |
| `notifications-channels` | Channel providers (email · Telegram · Discord) | Channel providers | email |
| `notifications-settings-matrix` | Settings matrix (channel × type) | Settings matrix | channel × type |
| `jobs-scheduler` | Jobs & scheduling (registry, runner, platform-owned cadence) | Jobs and scheduling | registry; platform-owned cadence |
| `jobs-platform-scheduling` | Platform scheduling (Vercel cron vs container `setInterval`) | Platform scheduling | container setinterval |
| `jobs-registered-catalog` | Registered jobs (retention, cleanup, sync, delivery) | Registered jobs | retention; cleanup; sync; delivery |
| `pwa-service-worker` | Service-worker caching contract (HTML network-only, kill switch) | Service-worker caching contract | html network-only |
| `pwa-update-flow` | Update flow (silent + idle toast, no auto skipWaiting) | Update flow | silent; idle toast; no auto skipwaiting |
| `pwa-web-push` | Web push channel (declarative JSON, no PII) | Web push channel | declarative json |
| `3d-threlte-integration` | Threlte integration (SSR-off, code-split model registry) | Threlte integration | ssr-off; code-split model registry |
| `3d-model-viewer-customizer` | Full-screen model viewer & customizer (layout reset) | Full-screen model viewer and customizer | — |
| `product-connection-engine` | Product composition engine (typed ports, couplings, conduits) | Product composition engine | typed ports; couplings; conduits |
| `asset-production-pipeline` | Asset production pipeline (typed request → checked GLB) | Asset production pipeline | typed request → checked glb |
| `agentic-parametric-modeling` | Agentic parametric modeling (MCP 3D) | Agentic parametric modeling | — |
| `content-blog-engine` | Blog engine (posts, revisions, locale-aware publishing) | Blog engine | posts |
| `content-comments` | Comments (flat, per-locale, moderated) | Comments | flat; per-locale; moderated |
| `content-markdown-pipeline` | Markdown pipeline & custom syntax (directives, wikilinks) | Markdown pipeline and custom syntax | — |
| `content-markdown-editor` | Markdown editor (CodeMirror, slash commands) | Markdown editor | — |
| `desk-workspace` | Desk workspace (dock layout, focus architecture, mobile projection) | Desk workspace | dock layout; focus architecture; mobile projection |
| `desk-spreadsheet-panel` | Spreadsheet panel (file type, dual-mode) | Spreadsheet panel | file type; dual-mode |
| `desk-mobile-chrome` | Desk mobile chrome (tab strip + pill + drawers) | Desk mobile chrome | pill; drawers |
| `desk-panel-menus` | Composed panel menus (one array, desktop kebab + mobile sheet) | Composed panel menus | one array; desktop kebab; mobile sheet |
| `desk-ai-effects` | AI desk effects (tool results drive the workspace) | AI desk effects | tool results drive the workspace |
| `desk-explorer` | Explorer panel (unified file tree over N sources) | Explorer panel | unified file tree over n sources |
| `optimistic-mutation` | Optimistic mutation (fold-based rollback, idempotency keys) | Optimistic mutation | fold-based rollback; idempotency keys |
| `intent-preloading` | Intent-based preloading (six levels over SvelteKit triggers) | Intent-based preloading | six levels over sveltekit triggers |
| `virtualized-rendering` | Virtualized rendering (windowing maths split from the component) | Virtualized rendering | windowing maths split from the component |
| `hierarchical-cache` | Hierarchical cache (local → shared → origin, with key scope enforced) | Hierarchical cache | local → shared → origin; with key scope enforced |
| `stale-while-revalidate` | Stale-while-revalidate (and stale-if-error) | Stale-while-revalidate | — |
| `singleflight` | Singleflight / stampede protection (nobody waits on a lock) | Singleflight stampede protection | nobody waits on a lock |
| `query-budget` | Query budget and N+1 proof (counting is not proving) | Query budget and N+1 proof | counting is not proving |
| `critical-rendering-path` | Critical rendering path (the LCP element paints from the document) | Critical rendering path | lcp element paints from the document |
| `heavy-dependency-quarantine` | Heavy dependency quarantine (the baseline is the metric) | Heavy dependency quarantine | baseline is the metric |
| `side-effect-free-components` | Side-effect-free component tree (barrels that tree-shake) | Side-effect-free component tree | barrels that tree-shake |
| `main-thread-budget` | Main-thread budget (worker → WASM, each step measured) | Main-thread budget | worker → wasm; each step measured |
| `resilience-policy` | Resilience policy (breaker, bulkhead, shedding, bounded retry) | Resilience policy | breaker; shedding |
| `deadline-propagation` | Deadline propagation (one budget, divided) | Deadline propagation | one budget; divided |
| `latency-tracing` | Latency tracing (a v10r span API, Server-Timing as one renderer) | Latency tracing | server-timing as one renderer |
| `performance-budget-ratchet` | Performance budget and ratchet (targets aspire, ceilings hold) | Performance budget and ratchet | targets aspire; ceilings hold |
| `scenario-harness` | Performance scenario harness (adverse conditions, committed) | Performance scenario harness | adverse conditions; committed |
| `name-check` | Name check (resilient multi-source fan-out) | Name check | resilient multi-source fan-out |
| `source-of-truth-gate` | Source-of-truth gate (one owner, bound copies) | Source-of-truth gate | one owner; bound copies |
| `evidence-status-dimensions` | Evidence status dimensions (verdict, coverage, confidence, freshness kept apart) | Evidence status dimensions | freshness kept apart |
| `derivation-key` | Derivation key (freshness by input fingerprint) | Derivation key | freshness by input fingerprint |
| `reproducible-artifact-build` | Reproducible artifact build (regenerate-and-diff, or manifest + digest) | Reproducible artifact build | regenerate-and-diff; or manifest |
| `provenance-record` | Provenance record (entity, activity, agent — PROV-DM core) | Provenance record | entity; activity; agent — prov-dm core |
| `durable-step-execution` | Durable step execution (claim, lease, fence, receipts) | Durable step execution | claim; receipts |
| `versioned-document-session` | Versioned document session (save queue, drafts, CAS, explicit conflict) | Versioned document session | save queue; drafts; explicit conflict |
| `dynamic-attributes` | Dynamic attributes (self-describing records the user defines at runtime) | Dynamic attributes | self-describing records the user defines at runtime |
| `asset-rights-manifest` | Asset rights manifest (owned rights record + gate over shipped files) | Asset rights manifest | owned rights record; gate over shipped files |
| `encryption-key-ring` | Encryption key ring (envelopes name their key, rotation re-seals) | Encryption key ring | envelopes name their key; rotation re-seals |
| `url-search-state` | URL state (one typed spec for search params, navigate vs shallow writes) | URL state | one typed spec for search params; navigate; shallow writes |
| `form-draft-recovery` | Form draft recovery (kept in the browser, offered back, guarded only when lost) | Form draft recovery | kept in the browser; offered back; guarded only when lost |
| `ai-untrusted-content-boundary` | Untrusted-content boundary (the lethal trifecta, one rule per leg) | Untrusted-content boundary | one rule per leg |
| `ai-agent-actions` | Agent actions (one tool catalogue, server and client executors) | Agent actions | one tool catalogue; server and client executors |
| `ai-mcp-client` | MCP client (external tools projected into the one catalogue) | MCP client | external tools projected into the one catalogue |
| `ai-mcp-app-provider` | MCP App provider (an interactive View beside a text answer) | MCP App provider | interactive view beside a text answer |
| `ai-agent-to-agent` | Agent to agent (A2A specialist agents, served and delegated) | Agent to agent | a2a specialist agents; served and delegated |
| `ai-generative-ui` | Generative UI (A2UI surfaces rendered with the app's own components) | Generative UI | a2ui surfaces rendered with the app's own components |
| `ai-webmcp` | WebMCP publication of client actions (experiment) | WebMCP publication of client actions | — |
| `ai-agent-user-interaction` | AG-UI endpoint over the turn stream (experiment) | AG-UI endpoint over the turn stream | — |
| `ai-eval-regression-suite` | AI eval regression suite (golden set, deterministic graders over the turn trace, floor ratchet) | AI eval regression suite | deterministic graders over the turn trace; floor ratchet |
| `pim-sheet-transform-recipe` | PIM sheet transform with AI agents (profile, proposed recipe, deterministic run, target check) | PIM sheet transform with AI agents | profile; proposed recipe; deterministic run; target check |

</details>

## Benchmark

`bun run patterns:bench --compare pattern-library/bench/composition-baseline.json` (results committed in
`pattern-library/bench/composition-results.json`).

| Metric | Design (8) before → after | Holdout (10) before → after | All (18) before → after |
|---|---|---|---|
| Step precision | 46.7 → 46.7 | 63.6 → 63.6 | 50.0 → 50.0 |
| Step recall | 91.3 → 91.3 | 50.0 → 50.0 | 75.7 → 75.7 |
| Need recall | 61.1 → **94.4** | 41.7 → **50.0** | 53.3 → **76.7** |
| Fact need recall (selection-independent) | 55.6 → **100** | 25.0 → **100** | 43.3 → **100** |
| Spurious required needs | 5 → 8 | 0 → 0 | 5 → 8 |
| Optional constituents shown as optional | 0/2 → 0/2 | — | 0/2 → 0/2 |
| Plan tokens (estimated) | 6,021 → 6,615 | 2,432 → 2,663 | 8,453 → 9,278 (+9.8%) |

Reading it:

- **The facts are now complete.** Given the right steps, the registry names every need the golden sets expect,
  in design and holdout alike (fact need recall 100%: complete capability coverage against the current benchmark, not a claim about scenarios it does not contain). The remaining need-recall gap is entirely step selection:
  every missed need belongs to a step the planner did not pick (S2, H2, H3, H4, H9).
- **Spurious needs rose from 5 to 8, all from unnecessary steps.** Truthful needs on wrongly chosen steps are now
  visible: S1 `llm-provider`, `external-api`; S2 `llm-provider`, `relational-db`; S3 `relational-db`,
  `email-delivery`; S5 `wasm-toolchain`, `container-host`. This is the selection defect the review found, made
  measurable; Slice 4 removes it.
- **Holdout step recall stays 50%.** H2, H3, H4, H8 and H9 need light records the planner cannot reach today
  (finding F03); Slice 4 makes them eligible.
- **Plan tokens +9.8%**, inside the ≤ +10% target: more facts per step, same steps.
- Retrieval did not regress: `mcp:bench` Acc@1 dev / holdout / holdout2 = 100 / 80 / 82.4 (baseline 100 / 80 / 79.4).

Acceptance (roadmap Slice 1): 0 undeclared adapter imports ✓; "hosted mcp" plan names `key-value-store` ✓
(see the S3 correction below); 0 node-kind contradictions ✓; 0 title numerals outside the allow-list ✓; need
recall up with no step-metric drop ✓.

## Unresolved issues

1. **S3 golden correction.** Curating against the code showed the hosted MCP authenticates with environment bearer
   tokens; Postgres holds only demo state and telemetry, so `relational-db` is implementation level there. The
   design scenario was corrected with a dated reason in the fixture's `changes`; the roadmap acceptance line
   that named `relational-db` for "hosted mcp" is superseded by this. Please confirm or overrule.
2. **S8 level disagreement.** `name-check` declares `relational-db` and `key-value-store` as conditional (it runs
   without them, degraded); the golden set says required. Need recall counts both levels, so S8 scores OK. The
   golden set was not changed; this needs your ruling.
3. **Maturity warnings.** `patterns:validate` still warns on 13 records "promote to proven" because a test ref
   exists. That is the rule D-08 rejects; it is left as is until Slice 5 replaces maturity. Do not act on it.
4. Golden sets and need levels are reviewer judgement from docs and code. The scan proves a need exists in code;
   whether it is required or conditional for an adopter is a judgement each record states in `when`/`why`.

## Verification and its limits

- `bun run validate` (cloud, heap cap set by hand): every step green — typecheck, biome, 408 test files /
  4,746 tests, MCP stdio tests 25/25, bundle, apps, `patterns:validate` (0 errors, 13 warnings above),
  `patterns:check`, `skills:check`, `mcp:excerpts:check`, i18n, content, opacity. The first full run stopped at
  one stale MCP stdio assertion (it expected the old "This plan requires" line); after the fix the remaining
  steps were run individually and passed.
- Not run in the cloud: `db:ingest-docs` (no database), anything against Neo4j or live providers, the
  production build (`validate:build`), the Claude Code compat kit, a browser check of the Studio engineer page.
