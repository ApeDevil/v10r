# Velociraptor (v10r)

v10r is a containerized full-stack **Pattern Library**: proven, high-performance, free-tier-friendly patterns to **emulate** — adapting only what a new project needs — rather than clone. It runs live at **[www.v10r.dev](https://www.v10r.dev/)**.


## What v10r is

| v10r IS | v10r IS NOT |
|---|---|
| A pattern library to read | A template repo to clone |
| A living reference implementation | A boilerplate starter (`create-app`, `degit`) |
| A working model to emulate | A framework or library to import |

Working instances:

- `v10r(lynx)` = [v4.lynxware.org](https://v4.lynxware.org/)
- `v10r(densho)` = [densho.media](https://www.densho.media/)


## How to use

Identify the capabilities your project needs, emulate only the relevant patterns. The [Pattern Index](#pattern-index) below maps every pattern to its docs, code, and proof.

**The live site** — [www.v10r.dev](https://www.v10r.dev/): every pattern proven on a working showcase page.

**The code** — clone or browse: `https://gitlab.com/ApeDevil/v10r` · `https://github.com/ApeDevil/v10r`

**The Pattern MCP** — curated pattern cards instead of raw files: the invariants that must hold, notes on what to adapt, dependency-ordered emulation plans. Hosted, nothing to clone:

```bash
claude mcp add --transport http v10r https://www.v10r.dev/api/mcp/public
```

Or offline against your own checkout — an ephemeral, network-isolated container with the repo mounted read-only:

```bash
claude mcp add --scope user --transport stdio v10r-patterns -- \
  podman run -i --rm --network=none -v /path/to/velociraptor:/v10r:ro \
  docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
```

Six tools: `search_patterns` (find candidates) → `get_pattern` (full card) → `recommend_emulation_plan` (build order) → `get_file_excerpt` (bounded read); `trace_capability` walks one concept from docs to code to test to proof, and `validate_snippet` checks the code you wrote back against v10r conventions. Details: [mcp/README.md](./mcp/README.md).


## Getting Started

These commands spin up v10r locally so you can explore the patterns — everything runs in the container, the host stays clean. To build *from* v10r, see [How to use](#how-to-use).

```bash
cp .env.example .env                  # fill in DATABASE_URL
podman compose up -d                  # start container
podman exec v10r bun run db:setup     # bootstrap DB (extensions → push → RAG → Neo4j)
```

Once running, every showcase page is simultaneously documentation and test: if it works, the pattern is proven functional.


## Core Stack

**Podman + Bun + SvelteKit** with relational database, graph database, and object storage.

```
Podman                  Container (runs everything)
└─ Bun                  Runtime (executes JavaScript)
    └─ SvelteKit        Framework
            └─ Vite     Build tool (SvelteKit's choice, not Bun's)
```

See [docs/stack/README.md](./docs/stack/README.md) for complete technology decisions. For everything the stack can do, see the [Pattern Index](#pattern-index).


## Documentation Map

Start at [`docs/README.md`](./docs/README.md) — every docs directory is a navigation hub; drill down through the READMEs to find the right file. Two cross-cutting maps sit above the layers:

- **[system-abstraction.md](./docs/system-abstraction.md)** — how the system runs (runtime 7-layer hierarchy, request flow, hooks).
- **[codebase-organization.md](./docs/codebase-organization.md)** — where code lives (source tree, canonical homes, import rules).


## Pattern Index

The complete map of every pattern in this repo — generated from [`mcp/patterns.registry.json`](mcp/patterns.registry.json), the same registry the Pattern MCP serves. Each row links the pattern's page and points to the documentation that explains it, the code that implements it, and — where one exists — the showcase page that proves it.

<!-- PATTERN-INDEX:START — generated from mcp/patterns.registry.json by scripts/patterns/build-derived.ts; do not edit (bun run patterns:build) -->

> **Bold** patterns are deep-tier: their pages carry invariants and emulation notes; the rest are index
> rows pointing at docs, code, and proof. Showcase routes live on disk under
> `src/routes/[[locale=locale]]/(public)/showcases/` — append the route path shown. Routes in parentheses,
> like (`/desk`), mean there is no showcase; the pattern is live at that app route.

- **Foundations:** [Architecture & Request Pipeline](#architecture--request-pipeline) · [App Shell & Navigation](#app-shell--navigation) · [UI Components & Design System](#ui-components--design-system) · [Forms & Validation](#forms--validation) · [Internationalization (i18n)](#internationalization-i18n) · [Docs & Agent Experience](#docs--agent-experience)
- **Data:** [Databases & Storage](#databases--storage) · [Database Operations](#database-operations)
- **Identity & Safety:** [Identity & Access](#identity--access) · [Anti-Abuse](#anti-abuse) · [Admin & Privacy](#admin--privacy)
- **Intelligence:** [AI](#ai) · [Toolkits](#toolkits)
- **Features:** [Analytics](#analytics) · [Notifications](#notifications) · [Jobs & Scheduling](#jobs--scheduling) · [PWA](#pwa) · [Data Viz](#data-viz) · [3D](#3d) · [Content, Blog & Desk](#content-blog--desk)

### Architecture & Request Pipeline

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [**Multi-client core (hexagonal domain modules)**](docs/pattern-library/multi-client-core.md) | [blueprint/architecture/multi-client-core.md](docs/blueprint/architecture/multi-client-core.md) (The full pattern: canonical module shape, client wiring, error contract) · [system-abstraction.md](docs/system-abstraction.md) (Runtime 7-layer view showing where domain modules sit) · [codebase-organization.md](docs/codebase-organization.md) (Where each piece lives; import direction rules) | [src/lib/server/](src/lib/server/) (Per-domain modules; canonical shape is [domain]/queries.ts + mutations.ts (+ service.ts only when orchestration spans multiple infra calls)) | — |
| [Runtime layers & request flow (7-layer view)](docs/pattern-library/architecture-runtime-layers.md) | [system-abstraction.md](docs/system-abstraction.md) | [src/hooks.server.ts](src/hooks.server.ts) | — |
| [Codebase map ("where does X live")](docs/pattern-library/architecture-codebase-map.md) | [codebase-organization.md](docs/codebase-organization.md) | [src/](src/) | — |
| [Middleware / 14-stage hook chain (CSRF, headers, guards)](docs/pattern-library/architecture-middleware.md) | [blueprint/middleware.md](docs/blueprint/middleware.md) | [src/hooks.server.ts](src/hooks.server.ts) · [src/lib/server/security/](src/lib/server/security/) | — |
| [REST API patterns (pagination, envelopes, rate limits)](docs/pattern-library/architecture-rest-api.md) | [blueprint/api.md](docs/blueprint/api.md) · [stack/capabilities/api.md](docs/stack/capabilities/api.md) | [src/routes/api/](src/routes/api/) · [src/lib/server/api/](src/lib/server/api/) | — |
| [Error handling (expected/unexpected/form/API)](docs/pattern-library/architecture-error-handling.md) | [blueprint/error-handling.md](docs/blueprint/error-handling.md) | [src/lib/server/errors/](src/lib/server/errors/) · [src/lib/errors/](src/lib/errors/) | `/showcases/shell/errors` |
| [State management (Svelte 5 runes)](docs/pattern-library/architecture-state-management.md) | [blueprint/state.md](docs/blueprint/state.md) | [src/lib/state/](src/lib/state/) | — |
| [Request-cycle visualizer (form · API · AI)](docs/pattern-library/architecture-request-cycle-visualizer.md) | [system-abstraction.md](docs/system-abstraction.md) | [src/lib/server/cycle/](src/lib/server/cycle/) · [src/lib/components/cycle/](src/lib/components/cycle/) | `/showcases/cycle/form` · `/showcases/cycle/api` · `/showcases/cycle/ai` |
| [Deployment (Vercel primary, tri-target)](docs/pattern-library/architecture-deployment.md) | [blueprint/deployment.md](docs/blueprint/deployment.md) · [stack/ops/deployment.md](docs/stack/ops/deployment.md) | [svelte.config.js](svelte.config.js) · [vercel.json](vercel.json) | — |
| [Testing infrastructure (Vitest, PGlite isolation)](docs/pattern-library/architecture-testing-infra.md) | [blueprint/testing/ai-testing-infrastructure.md](docs/blueprint/testing/ai-testing-infrastructure.md) | [src/lib/server/test/](src/lib/server/test/) · [vitest.config.ts](vitest.config.ts) | — |
| [Pattern MCP (agent-queryable pattern registry, local stdio)](docs/pattern-library/architecture-pattern-mcp.md) | [blueprint/architecture/pattern-mcp.md](docs/blueprint/architecture/pattern-mcp.md) | [mcp/](mcp/) | `/showcases/mcp` |
| [Hosted MCP (two trust surfaces: public read-only · bearer admin)](docs/pattern-library/architecture-hosted-mcp.md) | [blueprint/architecture/hosted-mcp.md](docs/blueprint/architecture/hosted-mcp.md) | [src/lib/server/mcp/](src/lib/server/mcp/) · [src/routes/api/mcp/](src/routes/api/mcp/) | — (`POST /api/mcp/public` · `/admin/mcp`) |

### App Shell & Navigation

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Shell layout (no global header, sidebar-first)](docs/pattern-library/app-shell-layout.md) | [blueprint/app-shell/layout.md](docs/blueprint/app-shell/layout.md) | [src/lib/components/shell/AppShell.svelte](src/lib/components/shell/AppShell.svelte) | — |
| [Responsive sidebar (rail / drawer / FAB)](docs/pattern-library/app-shell-sidebar.md) | [blueprint/app-shell/sidebar.md](docs/blueprint/app-shell/sidebar.md) | [src/lib/components/shell/](src/lib/components/shell/) · [src/lib/state/sidebar.svelte.ts](src/lib/state/sidebar.svelte.ts) | `/showcases/shell/sidebar` |
| [Navigation structure & progressive disclosure](docs/pattern-library/app-shell-navigation.md) | [blueprint/app-shell/navigation.md](docs/blueprint/app-shell/navigation.md) | [src/lib/nav/](src/lib/nav/) | — |
| [Keyboard shortcuts registry + help modal](docs/pattern-library/app-shell-keyboard-shortcuts.md) | [blueprint/app-shell/keyboard-shortcuts.md](docs/blueprint/app-shell/keyboard-shortcuts.md) | [src/lib/shortcuts/](src/lib/shortcuts/) · [src/lib/components/shell/ShortcutsModal.svelte](src/lib/components/shell/ShortcutsModal.svelte) | `/showcases/shell/shortcuts` |
| [Modals & layer stack](docs/pattern-library/app-shell-modals.md) | [blueprint/app-shell/shell-state.md](docs/blueprint/app-shell/shell-state.md) | [src/lib/state/modals.svelte.ts](src/lib/state/modals.svelte.ts) · [src/lib/components/primitives/dialog/](src/lib/components/primitives/dialog/) | `/showcases/shell/modals` |
| [Toasts (stacking, undo)](docs/pattern-library/app-shell-toasts.md) | [blueprint/app-shell/toast.md](docs/blueprint/app-shell/toast.md) | [src/lib/components/composites/toast/](src/lib/components/composites/toast/) · [src/lib/state/toast.svelte.ts](src/lib/state/toast.svelte.ts) | `/showcases/shell/toasts` |
| [Session lifecycle UI (expiry, re-auth)](docs/pattern-library/app-shell-session-lifecycle.md) | [blueprint/app-shell/session-lifecycle.md](docs/blueprint/app-shell/session-lifecycle.md) | [src/lib/components/shell/session/](src/lib/components/shell/session/) · [src/lib/state/session.svelte.ts](src/lib/state/session.svelte.ts) | `/showcases/shell/session` |
| [Settings (theme cookie, language, a11y)](docs/pattern-library/app-shell-settings.md) | [blueprint/app-shell/settings.md](docs/blueprint/app-shell/settings.md) | [src/lib/state/theme.svelte.ts](src/lib/state/theme.svelte.ts) | — (`/account/settings`) |
| [Style randomizer (theme × typography × palette)](docs/pattern-library/app-shell-style-randomizer.md) | [foundation/style.md](docs/foundation/style.md) | [src/lib/styles/random/](src/lib/styles/random/) · [src/lib/server/style/](src/lib/server/style/) | `/showcases/shell/style` |
| [Loading states (skeletons, nav progress)](docs/pattern-library/app-shell-loading-states.md) | [blueprint/app-shell/loading-states.md](docs/blueprint/app-shell/loading-states.md) | [src/lib/components/primitives/skeleton/](src/lib/components/primitives/skeleton/) · [src/lib/components/shell/NavigationProgress.svelte](src/lib/components/shell/NavigationProgress.svelte) | — |
| [Empty states](docs/pattern-library/app-shell-empty-states.md) | [blueprint/app-shell/empty-states.md](docs/blueprint/app-shell/empty-states.md) | [src/lib/components/composites/empty-state/](src/lib/components/composites/empty-state/) | — |
| [Page header (per-page, XSS-safe)](docs/pattern-library/app-shell-page-header.md) | [blueprint/app-shell/page-header.md](docs/blueprint/app-shell/page-header.md) | [src/lib/components/composites/page-header/](src/lib/components/composites/page-header/) | — |
| [Quick Search / command palette (two-lane FTS)](docs/pattern-library/app-shell-quick-search.md) | [blueprint/quick-search/architecture.md](docs/blueprint/quick-search/architecture.md) | [src/lib/components/composites/command-palette/](src/lib/components/composites/command-palette/) · [src/lib/server/search/](src/lib/server/search/) | — (`/search` · `GET /api/search`) |

### UI Components & Design System

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [**Component-first UI system (primitives/composites/layout, CVA, tokens)**](docs/pattern-library/ui-component-system.md) | [blueprint/design/README.md](docs/blueprint/design/README.md) (Design philosophy hub) · [blueprint/design/components.md](docs/blueprint/design/components.md) (Layer system and CVA variant rules) · [blueprint/design/tokens.md](docs/blueprint/design/tokens.md) (Token architecture (breakpoints, fluid type/space, elevation)) · [blueprint/design/styling.md](docs/blueprint/design/styling.md) (Styling flow and layout primitives) | [src/lib/components/primitives/](src/lib/components/primitives/) (~40 styled atoms wrapping Bits UI) · [src/lib/components/composites/](src/lib/components/composites/) (Components with business logic) · [src/lib/components/layout/](src/lib/components/layout/) (Structural wrappers (Stack, Cluster, Surface)) · [src/lib/styles/tokens.ts](src/lib/styles/tokens.ts) (Design tokens) · [uno.config.ts](uno.config.ts) (UnoCSS theme wiring) | `/showcases/ui/components` · `/showcases/ui/layouts` · `/showcases/ui/tokens` |
| [Design philosophy & three-tier theming](docs/pattern-library/ui-design-philosophy.md) | [blueprint/design/README.md](docs/blueprint/design/README.md) | [src/app.css](src/app.css) · [src/lib/styles/tokens.ts](src/lib/styles/tokens.ts) | — |
| [Design tokens (breakpoints, fluid type/space, z-index)](docs/pattern-library/ui-design-tokens.md) | [blueprint/design/tokens.md](docs/blueprint/design/tokens.md) · [stack/ui/unocss.md](docs/stack/ui/unocss.md) | [src/lib/styles/tokens.ts](src/lib/styles/tokens.ts) · [uno.config.ts](uno.config.ts) | `/showcases/ui/tokens` |
| [Tonal (surface) elevation engine](docs/pattern-library/ui-tonal-elevation.md) | [blueprint/design/tokens.md](docs/blueprint/design/tokens.md) | [src/lib/styles/elevation.ts](src/lib/styles/elevation.ts) · [src/lib/components/layout/](src/lib/components/layout/) | `/showcases/ui/layouts` |
| [Primitives (~40 Bits UI wrappers)](docs/pattern-library/ui-primitives.md) | [blueprint/design/components.md](docs/blueprint/design/components.md) · [stack/ui/bits-ui.md](docs/stack/ui/bits-ui.md) | [src/lib/components/primitives/](src/lib/components/primitives/) | `/showcases/ui/components/primitives` |
| [Composites](docs/pattern-library/ui-composites.md) | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/composites/](src/lib/components/composites/) | `/showcases/ui/components/composites` |
| [Layout primitives (Stack, Cluster, Surface)](docs/pattern-library/ui-layout-primitives.md) | [blueprint/design/styling.md](docs/blueprint/design/styling.md) | [src/lib/components/layout/](src/lib/components/layout/) | `/showcases/ui/layouts` |
| [Fluid responsive styling (UnoCSS, container queries)](docs/pattern-library/ui-fluid-styling.md) | [blueprint/design/styling.md](docs/blueprint/design/styling.md) · [stack/ui/unocss.md](docs/stack/ui/unocss.md) | [uno.config.ts](uno.config.ts) | — |
| [Tables](docs/pattern-library/ui-tables.md) | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/primitives/table/](src/lib/components/primitives/table/) | `/showcases/ui/tables` |
| [Menus (dropdown, context, menu bar)](docs/pattern-library/ui-menus.md) | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/composites/dropdown-menu/](src/lib/components/composites/dropdown-menu/) · [src/lib/components/composites/context-menu/](src/lib/components/composites/context-menu/) · [src/lib/components/composites/menu-bar/](src/lib/components/composites/menu-bar/) | `/showcases/ui/menus` |
| [Split panes (resizable · reorderable)](docs/pattern-library/ui-split-panes.md) | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/primitives/pane/](src/lib/components/primitives/pane/) · [src/lib/components/composites/reorderable-panes/](src/lib/components/composites/reorderable-panes/) | `/showcases/ui/splits` |
| [Workbench / dock layout](docs/pattern-library/ui-workbench.md) | [blueprint/desk/README.md](docs/blueprint/desk/README.md) | [src/lib/components/composites/dock/](src/lib/components/composites/dock/) | `/showcases/ui/workbench` |
| [Typography](docs/pattern-library/ui-typography.md) | [blueprint/design/tokens.md](docs/blueprint/design/tokens.md) | [src/lib/components/primitives/typography/](src/lib/components/primitives/typography/) | `/showcases/ui/typography` |
| [Decorative (ornaments · backgrounds)](docs/pattern-library/ui-decorative.md) | [foundation/style.md](docs/foundation/style.md) | [src/lib/components/primitives/decorative/](src/lib/components/primitives/decorative/) | `/showcases/ui/decorative` |

### Forms & Validation

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Superforms + Valibot foundation](docs/pattern-library/forms-superforms-valibot.md) | [blueprint/forms.md](docs/blueprint/forms.md) · [stack/forms/superforms.md](docs/stack/forms/superforms.md) | [src/lib/schemas/](src/lib/schemas/) · [src/lib/components/composites/form-field/](src/lib/components/composites/form-field/) | `/showcases/forms` |
| [Basic forms (contact · settings)](docs/pattern-library/forms-basic-forms.md) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/basics/contact` · `/showcases/forms/basics/settings` |
| [Validation timing (realtime · async · server)](docs/pattern-library/forms-validation-timing.md) | [blueprint/forms.md](docs/blueprint/forms.md) · [stack/forms/valibot.md](docs/stack/forms/valibot.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/validation/realtime` · `/showcases/forms/validation/async` · `/showcases/forms/validation/server` |
| [Multi-step & dynamic (wizard · dynamic · dependent)](docs/pattern-library/forms-multi-step-dynamic.md) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/patterns/wizard` · `/showcases/forms/patterns/dynamic` · `/showcases/forms/patterns/dependent` |
| [Advanced (confirm · reset · edit)](docs/pattern-library/forms-advanced-patterns.md) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/advanced/confirm` · `/showcases/forms/advanced/reset` · `/showcases/forms/advanced/edit` |
| [Auth forms (Better Auth client, not Superforms)](docs/pattern-library/forms-auth-forms.md) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/auth-client.ts](src/lib/auth-client.ts) | `/showcases/forms/auth` |
| [File uploads (withFiles + Sharp + R2)](docs/pattern-library/forms-file-uploads.md) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/server/store/](src/lib/server/store/) | — |

### Internationalization (i18n)

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Locale routing (optional catch-all, matcher, 308 canonical)](docs/pattern-library/i18n-locale-routing.md) | [blueprint/i18n.md](docs/blueprint/i18n.md) | [src/params/locale.ts](src/params/locale.ts) | `/showcases/i18n` |
| [Messages (Paraglide JS, ICU, compile-time)](docs/pattern-library/i18n-messages.md) | [blueprint/i18n.md](docs/blueprint/i18n.md) · [stack/i18n/paraglide.md](docs/stack/i18n/paraglide.md) | [messages/](messages/) (generated `src/lib/paraglide/` is gitignored) | `/showcases/i18n` |
| [Formatting & CLDR plural correctness](docs/pattern-library/i18n-formatting.md) | [blueprint/i18n.md](docs/blueprint/i18n.md) | [src/lib/i18n/](src/lib/i18n/) | — |
| [DB content i18n (JSONB sidecar + `tc()`)](docs/pattern-library/i18n-db-content.md) | [blueprint/i18n.md](docs/blueprint/i18n.md) | [src/lib/i18n/translate.ts](src/lib/i18n/translate.ts) | — |

### Docs & Agent Experience

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [**Docs navigation hubs (README-per-directory convention)**](docs/pattern-library/docs-nav-hubs.md) | [README.md](docs/README.md) (Root hub — the entry point of the whole convention) · [blueprint/README.md](docs/blueprint/README.md) (Example directory hub with topic tables) · [blueprint/ai/README.md](docs/blueprint/ai/README.md) (Second example hub (AI subsystem)) | — | — |
| [**Pattern Index (the generated README capability map)**](docs/pattern-library/pattern-index.md) | [README.md](README.md) (The Pattern Index section itself (anchor #pattern-index)) | [scripts/patterns/build-derived.ts](scripts/patterns/build-derived.ts) (Generates the README region + docs/pattern-library/ pages; --check mode gates staleness) · [src/lib/server/patterns/render.ts](src/lib/server/patterns/render.ts) (Pure renderers (testable, Vite-free)) · [src/lib/showcases/registry.ts](src/lib/showcases/registry.ts) (Showcase-route cells are validated against this registry's hrefs) | — |
| [**Agent Experience (AX) surfaces**](docs/pattern-library/agent-experience.md) | [blueprint/architecture/agent-experience.md](docs/blueprint/architecture/agent-experience.md) (The full AX layer: surfaces, derivation map, negotiation contract) · [blueprint/architecture/hosted-mcp.md](docs/blueprint/architecture/hosted-mcp.md) (The hosted MCP surface the Next-actions convention lives on) | [AGENTS.md](AGENTS.md) (Universal agent contract at the repo root) · [src/lib/server/docs/markdown-hook.ts](src/lib/server/docs/markdown-hook.ts) (The .md layer + Accept: text/markdown negotiation (303 + Vary + no-store)) · [src/lib/server/docs/llms-txt.ts](src/lib/server/docs/llms-txt.ts) (/llms.txt built per request from the docs manifest) · [src/lib/server/mcp/snippet/engine.ts](src/lib/server/mcp/snippet/engine.ts) (validate_snippet rule engine (findings are a success; input never echoed)) · [scripts/patterns/build-derived.ts](scripts/patterns/build-derived.ts) (Pattern-library generator (README region + per-pattern pages)) | `/showcases/ax` |

### Databases & Storage

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Postgres client & connection (Neon serverless)](docs/pattern-library/databases-postgres-connection.md) | [blueprint/db/relational.md](docs/blueprint/db/relational.md) · [stack/data/postgres.md](docs/stack/data/postgres.md) | [src/lib/server/db/index.ts](src/lib/server/db/index.ts) | `/showcases/db/relational/connection` |
| [Schema & type inference (Drizzle, 14 namespaces)](docs/pattern-library/databases-schema-type-inference.md) | [blueprint/db/relational.md](docs/blueprint/db/relational.md) · [stack/data/drizzle.md](docs/stack/data/drizzle.md) | [src/lib/server/db/schema/](src/lib/server/db/schema/) | `/showcases/db/relational/types` |
| [Queries/mutations split (reads-writes duality)](docs/pattern-library/databases-queries-mutations-split.md) | [codebase-organization.md](docs/codebase-organization.md) | [src/lib/server/db/](src/lib/server/db/) | `/showcases/db/relational/mutability` |
| [Neo4j connection (Aura)](docs/pattern-library/databases-neo4j-connection.md) | [blueprint/db/graph.md](docs/blueprint/db/graph.md) · [stack/data/neo4j.md](docs/stack/data/neo4j.md) | [src/lib/server/graph/](src/lib/server/graph/) | `/showcases/db/graph/connection` |
| [Graph modeling](docs/pattern-library/databases-graph-modeling.md) | [blueprint/db/graph.md](docs/blueprint/db/graph.md) | [src/lib/server/graph/](src/lib/server/graph/) | `/showcases/db/graph/model` |
| [Graph traversal](docs/pattern-library/databases-graph-traversal.md) | [blueprint/db/graph.md](docs/blueprint/db/graph.md) | [src/lib/server/graph/](src/lib/server/graph/) | `/showcases/db/graph/traversal` |
| [Polyglot freshness (Postgres ↔ Neo4j sync)](docs/pattern-library/databases-polyglot-freshness.md) | [blueprint/db/polyglot-freshness.md](docs/blueprint/db/polyglot-freshness.md) | [src/lib/server/graph/catalog.ts](src/lib/server/graph/catalog.ts) | — |
| [Object storage (Cloudflare R2, presigned transfer)](docs/pattern-library/databases-object-storage.md) | [stack/data/r2.md](docs/stack/data/r2.md) | [src/lib/server/store/](src/lib/server/store/) | `/showcases/db/storage/connection` · `/showcases/db/storage/objects` · `/showcases/db/storage/transfer` |
| [Cache (Upstash Redis, ephemeral patterns)](docs/pattern-library/databases-cache.md) | [stack/data/redis.md](docs/stack/data/redis.md) · [stack/ops/caching.md](docs/stack/ops/caching.md) | [src/lib/server/cache/](src/lib/server/cache/) | `/showcases/db/cache/connection` · `/showcases/db/cache/patterns` · `/showcases/db/cache/ephemeral` |

### Database Operations

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Dev→prod schema workflow (push-only, no migrations dir)](docs/pattern-library/db-ops-dev-prod-schema-workflow.md) | [blueprint/data/drizzle-workflow.md](docs/blueprint/data/drizzle-workflow.md) | [drizzle.config.ts](drizzle.config.ts) | — |
| [Neon branch refresh from prod (control plane, run ledger)](docs/pattern-library/db-ops-branch-refresh.md) | [blueprint/data/neon-branch-refresh.md](docs/blueprint/data/neon-branch-refresh.md) | [src/lib/server/neon/](src/lib/server/neon/) · [src/lib/server/dbops/](src/lib/server/dbops/) | — (`/admin/db`) |
| [DB bootstrap & seed](docs/pattern-library/db-ops-bootstrap-seed.md) | [blueprint/data/README.md](docs/blueprint/data/README.md) | [src/lib/server/db/seed/](src/lib/server/db/seed/) · [scripts/db/](scripts/db/) | — |

### Identity & Access

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Passwordless auth (magic link + OTP)](docs/pattern-library/identity-passwordless-auth.md) | [blueprint/auth.md](docs/blueprint/auth.md) · [stack/auth/better-auth.md](docs/stack/auth/better-auth.md) | [src/lib/server/auth/index.ts](src/lib/server/auth/index.ts) · [src/lib/auth-client.ts](src/lib/auth-client.ts) | `/showcases/auth/authn` |
| [OAuth (GitHub, Google)](docs/pattern-library/identity-oauth.md) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/](src/lib/server/auth/) | `/showcases/auth/authn` |
| [Route guards & per-route authorization](docs/pattern-library/identity-route-guards.md) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/guards.ts](src/lib/server/auth/guards.ts) | `/showcases/auth/authz` |
| [Capability grants (request → approve → expire)](docs/pattern-library/identity-capability-grants.md) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/grants.ts](src/lib/server/auth/grants.ts) · [src/lib/server/auth/grant-requests.ts](src/lib/server/auth/grant-requests.ts) | — |
| [Passkeys & step-up TOTP](docs/pattern-library/identity-passkeys.md) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/step-up.ts](src/lib/server/auth/step-up.ts) · [src/lib/server/auth/factor-changes.ts](src/lib/server/auth/factor-changes.ts) · [src/lib/components/composites/step-up-dialog/](src/lib/components/composites/step-up-dialog/) | — (`/account/security`) |
| [User management](docs/pattern-library/identity-user-management.md) | [blueprint/app-shell/user-account.md](docs/blueprint/app-shell/user-account.md) | [src/lib/server/db/user/](src/lib/server/db/user/) | `/showcases/auth/users` |

### Anti-Abuse

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [ALTCHA proof-of-work captcha](docs/pattern-library/anti-abuse-captcha.md) | [blueprint/abuse/captcha.md](docs/blueprint/abuse/captcha.md) | [src/lib/server/abuse/altcha.ts](src/lib/server/abuse/altcha.ts) · [src/lib/components/composites/altcha/](src/lib/components/composites/altcha/) | `/showcases/abuse/captcha` |
| [Honeypot (hidden field + min fill time)](docs/pattern-library/anti-abuse-honeypot.md) | [blueprint/abuse/honeypot.md](docs/blueprint/abuse/honeypot.md) | [src/lib/server/abuse/honeypot.ts](src/lib/server/abuse/honeypot.ts) | `/showcases/abuse/honeypot` |
| [Rate limiting (sliding window, fail-closed)](docs/pattern-library/anti-abuse-rate-limiting.md) | [blueprint/abuse/rate-limits.md](docs/blueprint/abuse/rate-limits.md) | [src/lib/server/abuse/rate-limit/](src/lib/server/abuse/rate-limit/) · [src/lib/server/api/rate-limit.ts](src/lib/server/api/rate-limit.ts) | `/showcases/abuse/rate-limits` |
| [AI daily token budget](docs/pattern-library/anti-abuse-ai-budget.md) | [blueprint/abuse/ai-budget.md](docs/blueprint/abuse/ai-budget.md) | [src/lib/server/ai/budget.ts](src/lib/server/ai/budget.ts) | `/showcases/abuse/ai-budget` |
| [Bot decision & abuse audit](docs/pattern-library/anti-abuse-bot-decision-audit.md) | [blueprint/abuse/README.md](docs/blueprint/abuse/README.md) | [src/lib/server/abuse/decision.ts](src/lib/server/abuse/decision.ts) · [src/lib/server/abuse/audit.ts](src/lib/server/abuse/audit.ts) | `/showcases/abuse` |

### Admin & Privacy

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Admin area, guards & data-table pattern](docs/pattern-library/admin-privacy-admin-area.md) | [blueprint/admin/README.md](docs/blueprint/admin/README.md) | [src/lib/server/admin/](src/lib/server/admin/) | `/showcases/admin` |
| [GDPR data transparency (view · export · delete)](docs/pattern-library/admin-privacy-gdpr.md) | [blueprint/app-shell/user-account.md](docs/blueprint/app-shell/user-account.md) · [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/server/privacy/](src/lib/server/privacy/) · [src/routes/api/me/](src/routes/api/me/) | `/showcases/privacy/data` · `/showcases/privacy/rights` |
| [Consent & cookies](docs/pattern-library/admin-privacy-consent-cookies.md) | [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/state/consent.svelte.ts](src/lib/state/consent.svelte.ts) · [src/lib/components/shell/ConsentBanner.svelte](src/lib/components/shell/ConsentBanner.svelte) | `/showcases/privacy/cookies` |
| [Data retention policy & purge jobs](docs/pattern-library/admin-privacy-data-retention.md) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) | [src/lib/server/jobs/](src/lib/server/jobs/) | `/showcases/privacy/retention` |
| [Cross-device debug pairing (QR + HMAC cookie)](docs/pattern-library/admin-privacy-pairing.md) | [blueprint/admin/pairing.md](docs/blueprint/admin/pairing.md) | [src/lib/server/pairing/](src/lib/server/pairing/) | — (`/pair/[code]`) |
| [Style picking + custom palettes](docs/pattern-library/admin-privacy-style-picking.md) | [blueprint/visual-identity-architecture.md](docs/blueprint/visual-identity-architecture.md) | [src/lib/server/branding/](src/lib/server/branding/) · [src/lib/components/branding/](src/lib/components/branding/) | `/showcases/shell/style` |
| [Audit log, announcements, feature flags](docs/pattern-library/admin-privacy-audit-log.md) | [blueprint/admin/README.md](docs/blueprint/admin/README.md) | [src/lib/server/admin/](src/lib/server/admin/) | — (`/admin`) |
| [Feedback capture](docs/pattern-library/admin-privacy-feedback.md) | [blueprint/abuse/honeypot.md](docs/blueprint/abuse/honeypot.md) | [src/lib/server/feedback/](src/lib/server/feedback/) | — (`/feedback`) |

### AI

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [**AI tool manifest & harness split (tool defs, risk metadata, registry)**](docs/pattern-library/ai-tool-harness.md) | [blueprint/ai/surfaces.md](docs/blueprint/ai/surfaces.md) (Tool calling and per-surface tool membership) · [blueprint/ai/harness-lens.md](docs/blueprint/ai/harness-lens.md) (Harness audit lens: loop, policy, compaction) | [src/lib/server/ai/tools/index.ts](src/lib/server/ai/tools/index.ts) (The manifest: chatbotToolMeta/deskbotToolMeta/allToolMeta maps + stepsForScopes) · [src/lib/server/ai/tools/_types.ts](src/lib/server/ai/tools/_types.ts) (Risk vocabulary: ToolRisk = read|create|write|destructive; ToolMeta) · [src/lib/server/ai/policy/governor.ts](src/lib/server/ai/policy/governor.ts) (requiresApproval(risk) + shouldRequirePlan) · [src/lib/server/ai/tool-leak-guard.ts](src/lib/server/ai/tool-leak-guard.ts) (Guard against tool/surface leakage) · [src/lib/server/ai/loop/compact.ts](src/lib/server/ai/loop/compact.ts) (Loop compaction (harness side)) | — |
| [**AI surfaces (chatbot vs deskbot split over one guard)**](docs/pattern-library/ai-surfaces.md) | [blueprint/ai/surfaces.md](docs/blueprint/ai/surfaces.md) (The surface split and per-surface rules) · [blueprint/ai/README.md](docs/blueprint/ai/README.md) (AI subsystem hub) · [blueprint/ai/desk-integration.md](docs/blueprint/ai/desk-integration.md) (How the deskbot integrates with the desk) | [src/lib/server/ai/guard.ts](src/lib/server/ai/guard.ts) (guardAiRequest() — the one shared gate) · [src/lib/server/ai/chat-orchestrator.ts](src/lib/server/ai/chat-orchestrator.ts) (Chatbot orchestration) · [src/lib/server/ai/deskbot-rag.ts](src/lib/server/ai/deskbot-rag.ts) (Deskbot retrieval side) · [src/routes/api/ai/chatbot/+server.ts](src/routes/api/ai/chatbot/+server.ts) (Chatbot route adapter) · [src/routes/api/ai/deskbot/+server.ts](src/routes/api/ai/deskbot/+server.ts) (Deskbot route adapter) · [src/lib/components/composites/chatbot/](src/lib/components/composites/chatbot/) (Chatbot UI) | `/showcases/ai/chatbot` · `/showcases/ai/deskbot` |
| [**Deskbot approval gate (proposal → approve, plan-gated mutation)**](docs/pattern-library/deskbot-approval-gate.md) | [blueprint/ai/harness-lens.md](docs/blueprint/ai/harness-lens.md) (Where the gate sits in the harness) · [blueprint/ai/desk-integration.md](docs/blueprint/ai/desk-integration.md) (Proposal lifecycle in the desk) | [src/lib/server/ai/tools/propose-plan.ts](src/lib/server/ai/tools/propose-plan.ts) (Proposal creation) · [src/lib/server/ai/tools/desk-execute.ts](src/lib/server/ai/tools/desk-execute.ts) (executeDeskToolCall — the one door) · [src/lib/server/ai/policy/governor.ts](src/lib/server/ai/policy/governor.ts) (requiresApproval(risk): write/destructive gated, read/create not) · [src/routes/api/ai/proposals/[id]/approve/+server.ts](src/routes/api/ai/proposals/[id]/approve/+server.ts) (Approve-route replay) | — |
| [**Layered RAG (llmwiki pointer layer over a rawrag kernel)**](docs/pattern-library/layered-rag.md) | [blueprint/ai/layered-rag.md](docs/blueprint/ai/layered-rag.md) (The two-layer architecture) · [blueprint/ai/knowledge-base.md](docs/blueprint/ai/knowledge-base.md) (Corpus and ingest door) · [blueprint/ai/graph-rag.md](docs/blueprint/ai/graph-rag.md) (Graph tier) | [src/lib/server/rawrag/index.ts](src/lib/server/rawrag/index.ts) (retrieve() — the single shared kernel) · [src/lib/server/rawrag/plan.ts](src/lib/server/rawrag/plan.ts) (Retrieval planning) · [src/lib/server/rawrag/tiers/](src/lib/server/rawrag/tiers/) (Tier implementations) · [src/lib/server/llmwiki/search.ts](src/lib/server/llmwiki/search.ts) (Pointer-layer search) · [src/lib/server/llmwiki/overview.ts](src/lib/server/llmwiki/overview.ts) (Deterministic system-overview anchor) | `/showcases/ai/chatbot` |
| [**Retrieval ingest/search endpoints (one ingest door, /api/retrieval/*)**](docs/pattern-library/retrieval-endpoints.md) | [blueprint/ai/knowledge-base.md](docs/blueprint/ai/knowledge-base.md) (The ingest door pattern) · [blueprint/ai/nrag-observability.md](docs/blueprint/ai/nrag-observability.md) (Observability over the pipeline) | [src/routes/api/retrieval/ingest/+server.ts](src/routes/api/retrieval/ingest/+server.ts) (Ingest endpoint (namespace is /api/retrieval/*, not /api/rag/*)) · [src/routes/api/retrieval/search/+server.ts](src/routes/api/retrieval/search/+server.ts) (Search endpoint) · [src/lib/server/rawrag/ingest/index.ts](src/lib/server/rawrag/ingest/index.ts) (Runtime ingest module) · [scripts/db/ingest-docs.ts](scripts/db/ingest-docs.ts) (Bun script sharing the same planChunks() door) | `/showcases/ai/chatbot` |
| [Chat assistant "Vely" (orchestrator, streaming)](docs/pattern-library/ai-chat-assistant.md) | [blueprint/ai/README.md](docs/blueprint/ai/README.md) · [stack/ai/ai-sdk.md](docs/stack/ai/ai-sdk.md) | [src/lib/server/ai/chat-orchestrator.ts](src/lib/server/ai/chat-orchestrator.ts) · [src/lib/components/composites/chatbot/](src/lib/components/composites/chatbot/) | `/showcases/ai/chatbot` |
| [Persistent minimizable chatbot session](docs/pattern-library/ai-chatbot-session.md) | [blueprint/ai/persistent-chatbot.md](docs/blueprint/ai/persistent-chatbot.md) | [src/lib/state/chatbot-session.svelte.ts](src/lib/state/chatbot-session.svelte.ts) | — |
| [Provider registry & routing (chat/tools/vision + circuit breaker)](docs/pattern-library/ai-provider-routing.md) | [blueprint/ai/provider-routing.md](docs/blueprint/ai/provider-routing.md) | [src/lib/server/ai/providers.ts](src/lib/server/ai/providers.ts) | — |
| [Chatbot site awareness (page context)](docs/pattern-library/ai-site-awareness.md) | [blueprint/ai/site-awareness.md](docs/blueprint/ai/site-awareness.md) | [src/lib/server/search/page-context.ts](src/lib/server/search/page-context.ts) | — |
| [Graph RAG pipeline (three tiers, RRF fusion)](docs/pattern-library/ai-graph-rag.md) | [blueprint/ai/graph-rag.md](docs/blueprint/ai/graph-rag.md) | [src/lib/server/rawrag/tiers/](src/lib/server/rawrag/tiers/) · [src/lib/server/graph/rag/](src/lib/server/graph/rag/) | `/showcases/ai/chatbot` |
| [Retrieval observability (waterfall, explorer)](docs/pattern-library/ai-retrieval-observability.md) | [blueprint/ai/nrag-observability.md](docs/blueprint/ai/nrag-observability.md) | [src/lib/server/rawrag/queries.ts](src/lib/server/rawrag/queries.ts) | `/showcases/ai/chatbot` |
| [Image metadata reader (vision)](docs/pattern-library/ai-image-metadata.md) | [blueprint/ai/image-metadata.md](docs/blueprint/ai/image-metadata.md) | [src/lib/server/imagemeta/](src/lib/server/imagemeta/) | `/showcases/toolkits/image-metadata` |
| [Cost & usage monitoring](docs/pattern-library/ai-cost-monitoring.md) | [blueprint/ai/cost-monitoring.md](docs/blueprint/ai/cost-monitoring.md) | [src/lib/server/ai/pricing.ts](src/lib/server/ai/pricing.ts) · [src/lib/server/ai/usage-summary.ts](src/lib/server/ai/usage-summary.ts) | — (`/admin/ai`) |
| [TOON token-efficient context format](docs/pattern-library/ai-toon-format.md) | [blueprint/ai/toon.md](docs/blueprint/ai/toon.md) | [src/lib/server/ai/context/](src/lib/server/ai/context/) | — |
| [Deskbot (AI in the desk workspace)](docs/pattern-library/ai-deskbot.md) | [blueprint/ai/desk-integration.md](docs/blueprint/ai/desk-integration.md) | [src/lib/server/ai/deskbot-rag.ts](src/lib/server/ai/deskbot-rag.ts) · [src/lib/server/agents/](src/lib/server/agents/) | — (`/desk`) |
| [Agent-harness audit lens (loop/context/policy/tools)](docs/pattern-library/ai-harness-lens.md) | [blueprint/ai/harness-lens.md](docs/blueprint/ai/harness-lens.md) | [src/lib/server/ai/loop/](src/lib/server/ai/loop/) · [src/lib/server/ai/policy/](src/lib/server/ai/policy/) | — |

### Toolkits

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Image Kit (upload → AI pipeline → adjust → approve, persists nothing)](docs/pattern-library/toolkits-image-kit.md) | [blueprint/ai/image-kit.md](docs/blueprint/ai/image-kit.md) | [src/lib/server/imagekit/](src/lib/server/imagekit/) | `/showcases/toolkits/image-kit` |

### Analytics

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Pageview collector hook (last of 14 middleware stages)](docs/pattern-library/analytics-pageview-hook.md) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/server/analytics/hook.ts](src/lib/server/analytics/hook.ts) | `/showcases/analytics/overview` |
| [Consent-gated sessions (cookieless day-rotating id)](docs/pattern-library/analytics-consent-sessions.md) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) · [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/server/analytics/consent.ts](src/lib/server/analytics/consent.ts) | `/showcases/analytics/privacy` |
| [User journeys (client beacon)](docs/pattern-library/analytics-journeys.md) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/analytics/journey-beacon.ts](src/lib/analytics/journey-beacon.ts) | `/showcases/analytics/journeys` |
| [Funnels](docs/pattern-library/analytics-funnels.md) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/server/db/analytics/](src/lib/server/db/analytics/) | `/showcases/analytics/funnels` |
| [Live events feed](docs/pattern-library/analytics-live-feed.md) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/server/analytics/](src/lib/server/analytics/) · [src/routes/api/analytics/](src/routes/api/analytics/) | `/showcases/analytics/live` |
| [Rollup & cleanup jobs](docs/pattern-library/analytics-rollup-cleanup.md) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) | [src/lib/server/jobs/analytics-rollup.ts](src/lib/server/jobs/analytics-rollup.ts) · [src/lib/server/jobs/analytics-cleanup.ts](src/lib/server/jobs/analytics-cleanup.ts) | — |
| [Visitor "my data" transparency](docs/pattern-library/analytics-my-data-transparency.md) | [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/server/analytics/](src/lib/server/analytics/) | `/showcases/analytics/my-data` |

### Notifications

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Router, outbox & delivery worker](docs/pattern-library/notifications-router-outbox.md) | [blueprint/notifications/routing.md](docs/blueprint/notifications/routing.md) | [src/lib/server/notifications/router.ts](src/lib/server/notifications/router.ts) · [src/lib/server/notifications/outbox.ts](src/lib/server/notifications/outbox.ts) | `/showcases/notifications/pipeline` |
| [Channel providers (email · Telegram · Discord)](docs/pattern-library/notifications-channels.md) | [blueprint/notifications/channels.md](docs/blueprint/notifications/channels.md) · [stack/notifications](docs/stack/notifications) | [src/lib/server/notifications/providers/](src/lib/server/notifications/providers/) | `/showcases/notifications/channels` |
| [In-app SSE stream & notification center](docs/pattern-library/notifications-sse-stream.md) | [blueprint/app-shell/notifications.md](docs/blueprint/app-shell/notifications.md) | [src/lib/server/notifications/stream.ts](src/lib/server/notifications/stream.ts) · [src/lib/state/notifications.svelte.ts](src/lib/state/notifications.svelte.ts) | `/showcases/notifications/send` |
| [Settings matrix (channel × type)](docs/pattern-library/notifications-settings-matrix.md) | [blueprint/notifications/settings.md](docs/blueprint/notifications/settings.md) | [src/lib/server/preferences/](src/lib/server/preferences/) | — (`/account/notifications`) |
| [Schema & delivery log](docs/pattern-library/notifications-schema-delivery-log.md) | [blueprint/notifications/schema.md](docs/blueprint/notifications/schema.md) | [src/lib/server/db/schema/notifications/](src/lib/server/db/schema/notifications/) | — |

### Jobs & Scheduling

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [**Jobs & scheduling (registry, runner, platform-owned cadence)**](docs/pattern-library/jobs-scheduler.md) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) (The full pattern including cadence ownership) | [src/lib/server/jobs/index.ts](src/lib/server/jobs/index.ts) (Registry: slug → execute function, nothing more) · [src/lib/server/jobs/runner.ts](src/lib/server/jobs/runner.ts) (runJob() unified runner) · [src/lib/server/jobs/scheduler.ts](src/lib/server/jobs/scheduler.ts) (Container-mode persistent setInterval scheduler) · [src/routes/api/cron/[job]/+server.ts](src/routes/api/cron/[job]/+server.ts) (Dynamic Vercel cron entry) · [vercel.json](vercel.json) (Where cron schedules live) | `/showcases/jobs` |
| [Platform scheduling (Vercel cron vs container `setInterval`)](docs/pattern-library/jobs-platform-scheduling.md) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) · [blueprint/deployment.md](docs/blueprint/deployment.md) | [src/lib/server/jobs/scheduler.ts](src/lib/server/jobs/scheduler.ts) · [src/routes/api/cron/](src/routes/api/cron/) · [vercel.json](vercel.json) | — |
| [Registered jobs (retention, cleanup, sync, delivery)](docs/pattern-library/jobs-registered-catalog.md) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) | [src/lib/server/jobs/](src/lib/server/jobs/) | — (`/admin/jobs`) |

### PWA

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Localized manifest & installability](docs/pattern-library/pwa-manifest.md) | [blueprint/pwa.md](docs/blueprint/pwa.md) · [stack/capabilities/pwa.md](docs/stack/capabilities/pwa.md) | [src/routes/manifest.webmanifest/](src/routes/manifest.webmanifest/) | `/showcases/pwa` |
| [Service-worker caching contract (HTML network-only, kill switch)](docs/pattern-library/pwa-service-worker.md) | [blueprint/pwa.md](docs/blueprint/pwa.md) | [src/service-worker.ts](src/service-worker.ts) | `/showcases/pwa` |
| [Update flow (silent + idle toast, no auto skipWaiting)](docs/pattern-library/pwa-update-flow.md) | [blueprint/pwa.md](docs/blueprint/pwa.md) | [src/lib/components/shell/UpdatePrompt.svelte](src/lib/components/shell/UpdatePrompt.svelte) | — |
| [Web push channel (declarative JSON, no PII)](docs/pattern-library/pwa-web-push.md) | [blueprint/pwa.md](docs/blueprint/pwa.md) | [src/lib/server/notifications/providers/](src/lib/server/notifications/providers/) | — |

### Data Viz

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Charts](docs/pattern-library/viz-charts.md) | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/chart/](src/lib/components/viz/chart/) | `/showcases/viz/charts` |
| [Plots](docs/pattern-library/viz-plots.md) | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/plot/](src/lib/components/viz/plot/) | `/showcases/viz/plots` |
| [Diagrams](docs/pattern-library/viz-diagrams.md) | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/diagram/](src/lib/components/viz/diagram/) | `/showcases/viz/diagrams` |
| [Node graphs](docs/pattern-library/viz-graphs.md) | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/graph/](src/lib/components/viz/graph/) | `/showcases/viz/graphs` |
| [Maps](docs/pattern-library/viz-maps.md) | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/map/](src/lib/components/viz/map/) | `/showcases/viz/maps` |
| [Timelines](docs/pattern-library/viz-timelines.md) | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/timeline/](src/lib/components/viz/timeline/) | — |

### 3D

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Threlte integration (SSR-off, code-split model registry)](docs/pattern-library/3d-threlte-integration.md) | [blueprint/3d/3d-integration.md](docs/blueprint/3d/3d-integration.md) · [stack/capabilities/3d-web.md](docs/stack/capabilities/3d-web.md) | [src/lib/components/3d/](src/lib/components/3d/) · [src/lib/config/models.ts](src/lib/config/models.ts) | `/showcases/3d` |
| [Static & animated scenes](docs/pattern-library/3d-static-animated-scenes.md) | [blueprint/3d/3d-quick-reference.md](docs/blueprint/3d/3d-quick-reference.md) | [src/lib/components/3d/SceneContent.svelte](src/lib/components/3d/SceneContent.svelte) | `/showcases/3d/static-scene` · `/showcases/3d/animated-scene` |
| [Full-screen model viewer & customizer (layout reset)](docs/pattern-library/3d-model-viewer-customizer.md) | [blueprint/3d/3d-integration.md](docs/blueprint/3d/3d-integration.md) | [src/lib/components/3d/customizer/](src/lib/components/3d/customizer/) · [src/lib/components/3d/ViewerScene.svelte](src/lib/components/3d/ViewerScene.svelte) | — (`/showcases/3d/[model]`) |

### Content, Blog & Desk

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| [Blog engine (posts, revisions, locale-aware publishing)](docs/pattern-library/content-blog-engine.md) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/server/blog/](src/lib/server/blog/) · [src/lib/components/blog/](src/lib/components/blog/) | — (`/blog`) |
| [Comments (flat, per-locale, moderated)](docs/pattern-library/content-comments.md) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/server/blog/](src/lib/server/blog/) | — |
| [Markdown pipeline & custom syntax (directives, wikilinks)](docs/pattern-library/content-markdown-pipeline.md) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/server/content/](src/lib/server/content/) · [src/lib/content-syntax/](src/lib/content-syntax/) | — |
| [Desk workspace (panels, DeskBus, file registry)](docs/pattern-library/content-desk-workspace.md) | [blueprint/desk/README.md](docs/blueprint/desk/README.md) | [src/lib/server/desk/](src/lib/server/desk/) · [src/lib/components/explorer/](src/lib/components/explorer/) | — (`/desk`) |
| [Spreadsheet panel (file type, dual-mode)](docs/pattern-library/content-spreadsheet-panel.md) | [blueprint/desk/spreadsheet.md](docs/blueprint/desk/spreadsheet.md) | [src/lib/components/spreadsheet/](src/lib/components/spreadsheet/) | — |
| [Markdown editor (CodeMirror, slash commands)](docs/pattern-library/content-markdown-editor.md) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/components/editor/](src/lib/components/editor/) | — |
| [Prerendered docs site](docs/pattern-library/content-docs-site.md) | [blueprint/pages.md](docs/blueprint/pages.md) | [src/lib/server/docs/](src/lib/server/docs/) | — (`/docs`) |

<!-- PATTERN-INDEX:END -->

