# Velociraptor (v10r)

v10r is a containerized full-stack **Pattern Library** for AI-assisted web development.

v10r's goal: **proven, high-performance** full-stack patterns. Rather than clone a template, your coding agent **emulates** them — adapting only what a new project needs. Lightweight and free-tier friendly.

> Fast and dangerous (in a good way).


## What v10r is

| v10r IS | v10r IS NOT |
|---|---|
| A pattern library for AI agents to read | A template repo to clone |
| A living reference implementation | A boilerplate starter (`create-app`, `degit`) |
| A working model your agent emulates | A framework or library to import |

Instances don't clone files. An AI agent reads v10r's tested patterns and adapts only the pieces a new project needs. Static scaffolds give you files. v10r gives you a working model to build from.

The naming follows function-call syntax: `v10r(x)` — v10r is the function, x is the argument.

### Spectrum

| Instance | Capabilities used |
|---|---|
| `v10r(landing-page)` | SvelteKit, UnoCSS — 2 of 18 |
| `v10r(lynx)` | SvelteKit, UnoCSS, Bits UI, markdown pipeline — 5 of 18 |
| `v10r(full-platform)` | Everything — 18 of 18 |

**`v10r(lynx)`** is [v4.lynxware.org](https://v4.lynxware.org/) — a keyboard firmware documentation site. Static prerendered. Dropped: auth, databases, API, i18n, AI, 3D.

### Creating a new instance

Point your coding agent at v10r, identify the capabilities the project needs, and let it emulate only the relevant patterns. The [Pattern Index](#pattern-index) below maps every capability to its documentation and code.

**Local** — place the repos side by side:

```
dev/
├── velociraptor/      ← reference
├── your-project/      ← instance
```

**Remote** — point your agent to the hosted repo:

- `https://gitlab.com/ApeDevil/v10r`
- `https://github.com/ApeDevil/v10r`


## Getting Started

These commands spin up v10r locally so you can explore the patterns. To build a new project *from* v10r, see [What v10r is](#what-v10r-is).

```bash
cp .env.example .env                  # fill in DATABASE_URL
podman compose up -d                  # start container
podman exec v10r bun run db:setup     # bootstrap DB (extensions → push → RAG → Neo4j)
```

### Local Development

Clean host system + portable setup

```
┌───────────────────────────────────────────┐
│  Host Machine                             │
│  ┌───────────────────────────────────┐    │
│  │  Podman Container (v10r)          │    │
│  │  ┌───────────────────────────┐    │    │
│  │  │  Bun + SvelteKit          │    │    │
│  │  └───────────────────────────┘    │    │
│  └───────────────────────────────────┘    │
└───────────────────────────────────────────┘
```


## Core Stack

**Podman + Bun + SvelteKit** with relational database, graph database, and object storage.

```
Podman                  Container (runs everything)
└─ Bun                  Runtime (executes JavaScript)
    └─ SvelteKit        Framework
            └─ Vite     Build tool (SvelteKit's choice, not Bun's)
```

See [docs/stack/README.md](./docs/stack/README.md) for complete technology decisions. For everything the stack can do, see the [Pattern Index](#pattern-index).


## Self-Documenting Architecture

**The app documents itself by being itself.**

Every showcase page serves two purposes simultaneously:

| Role | What It Does |
|------|--------------|
| **Documentation** | Explains how the feature works |
| **Test** | Proves the feature works |

If a showcase page works, the feature is proven functional.


## Documentation Map

The `docs/` folder uses an AI-optimized navigation structure: each directory has a README.md that acts as a **navigation hub** with topic tables showing which file covers what. AI agents find the right file faster, retrieval stays precise, and token usage stays low (read index → read target file, never everything).

**Navigation rule:** start at [`docs/README.md`](./docs/README.md), drill down through directory READMEs to find the right file.

Two cross-cutting maps sit above the layers — start with these for the whole-system view:

- **[system-abstraction.md](./docs/system-abstraction.md)** — how the system runs (runtime 7-layer hierarchy, request flow, hooks).
- **[codebase-organization.md](./docs/codebase-organization.md)** — where code lives (source tree, canonical homes, import rules). The annotated source tree is at [Top-level layout](./docs/codebase-organization.md#top-level-layout).

The layers themselves evolve from each other:

```
  Foundation (why/constraints) → Stack (what/choices) → Blueprint (how/implementation)
```

1. **[foundation/](./docs/foundation/)** — Source of truth (goals, requirements)
2. **[stack/](./docs/stack/)** — Technology decisions based on PRD
3. **[blueprint/](./docs/blueprint/)** — Implementation specs & strategy based on stack


## Why "Velociraptor"?

The requirements of the stack are performance and lightweight — and 'Velociraptor' represents those perfectly.

- **Veloci-** → "Velocity" → Speed (Bun is fast, Svelte is fast, containers are lightweight)
- **-raptor** → The dinosaur → Cool factor + a bit dangerous/experimental (it's a test project)
- The actual dinosaur name means **"swift thief"** in Latin (velox = swift, raptor = robber/thief)


## Pattern Index

The complete, hand-maintained map of every pattern in this repo. Each row points to the documentation that explains the pattern, the code that implements it, and — where one exists — the showcase page that proves it.

> Showcase routes live on disk under `src/routes/[[locale=locale]]/(public)/showcases/` — append the route path shown. Routes in parentheses, like (`/desk`), mean there is no showcase; the pattern is live at that app route.

- **Foundations:** [Architecture & Request Pipeline](#architecture--request-pipeline) · [App Shell & Navigation](#app-shell--navigation) · [UI Components & Design System](#ui-components--design-system) · [Forms & Validation](#forms--validation) · [Internationalization (i18n)](#internationalization-i18n)
- **Data:** [Databases & Storage](#databases--storage) · [Database Operations](#database-operations)
- **Identity & Safety:** [Identity & Access](#identity--access) · [Anti-Abuse](#anti-abuse) · [Admin & Privacy](#admin--privacy)
- **Intelligence:** [AI](#ai) · [Toolkits](#toolkits)
- **Features:** [Analytics](#analytics) · [Notifications](#notifications) · [Jobs & Scheduling](#jobs--scheduling) · [PWA](#pwa) · [Data Viz](#data-viz) · [3D](#3d) · [Content, Blog & Desk](#content-blog--desk)

### Architecture & Request Pipeline

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Multi-client core (hexagonal domain modules) | [blueprint/architecture/multi-client-core.md](docs/blueprint/architecture/multi-client-core.md) | [src/lib/server/](src/lib/server/) | — |
| Runtime layers & request flow (7-layer view) | [system-abstraction.md](docs/system-abstraction.md) | [src/hooks.server.ts](src/hooks.server.ts) | — |
| Codebase map ("where does X live") | [codebase-organization.md](docs/codebase-organization.md) | [src/](src/) | — |
| Middleware / 12-stage hook chain (CSRF, headers, guards) | [blueprint/middleware.md](docs/blueprint/middleware.md) | [src/hooks.server.ts](src/hooks.server.ts) · [src/lib/server/security/](src/lib/server/security/) | — |
| REST API patterns (pagination, envelopes, rate limits) | [blueprint/api.md](docs/blueprint/api.md) · [stack/capabilities/api.md](docs/stack/capabilities/api.md) | [src/routes/api/](src/routes/api/) · [src/lib/server/api/](src/lib/server/api/) | — |
| Error handling (expected/unexpected/form/API) | [blueprint/error-handling.md](docs/blueprint/error-handling.md) | [src/lib/server/errors/](src/lib/server/errors/) · [src/lib/errors/](src/lib/errors/) | `/showcases/shell/errors` |
| State management (Svelte 5 runes) | [blueprint/state.md](docs/blueprint/state.md) | [src/lib/state/](src/lib/state/) | — |
| Request-cycle visualizer (form · API · AI) | [system-abstraction.md](docs/system-abstraction.md) | [src/lib/server/cycle/](src/lib/server/cycle/) · [src/lib/components/cycle/](src/lib/components/cycle/) | `/showcases/cycle/form` · `/api` · `/ai` |
| Deployment (Vercel primary, tri-target) | [blueprint/deployment.md](docs/blueprint/deployment.md) · [stack/ops/deployment.md](docs/stack/ops/deployment.md) | [svelte.config.js](svelte.config.js) · [vercel.json](vercel.json) | — |
| Testing infrastructure (Vitest, PGlite isolation) | [blueprint/testing/ai-testing-infrastructure.md](docs/blueprint/testing/ai-testing-infrastructure.md) | [src/lib/server/test/](src/lib/server/test/) · [vitest.config.ts](vitest.config.ts) | — |

### App Shell & Navigation

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Shell layout (no global header, sidebar-first) | [blueprint/app-shell/layout.md](docs/blueprint/app-shell/layout.md) | [src/lib/components/shell/AppShell.svelte](src/lib/components/shell/AppShell.svelte) | — |
| Responsive sidebar (rail / drawer / FAB) | [blueprint/app-shell/sidebar.md](docs/blueprint/app-shell/sidebar.md) | [src/lib/components/shell/](src/lib/components/shell/) · [src/lib/state/sidebar.svelte.ts](src/lib/state/sidebar.svelte.ts) | `/showcases/shell/sidebar` |
| Navigation structure & progressive disclosure | [blueprint/app-shell/navigation.md](docs/blueprint/app-shell/navigation.md) | [src/lib/nav/](src/lib/nav/) | — |
| Keyboard shortcuts registry + help modal | [blueprint/app-shell/keyboard-shortcuts.md](docs/blueprint/app-shell/keyboard-shortcuts.md) | [src/lib/shortcuts/](src/lib/shortcuts/) · [ShortcutsModal.svelte](src/lib/components/shell/ShortcutsModal.svelte) | `/showcases/shell/shortcuts` |
| Modals & layer stack | [blueprint/app-shell/shell-state.md](docs/blueprint/app-shell/shell-state.md) | [src/lib/state/modals.svelte.ts](src/lib/state/modals.svelte.ts) · [src/lib/components/primitives/dialog/](src/lib/components/primitives/dialog/) | `/showcases/shell/modals` |
| Toasts (stacking, undo) | [blueprint/app-shell/toast.md](docs/blueprint/app-shell/toast.md) | [src/lib/components/composites/toast/](src/lib/components/composites/toast/) · [src/lib/state/toast.svelte.ts](src/lib/state/toast.svelte.ts) | `/showcases/shell/toasts` |
| Session lifecycle UI (expiry, re-auth) | [blueprint/app-shell/session-lifecycle.md](docs/blueprint/app-shell/session-lifecycle.md) | [src/lib/components/shell/session/](src/lib/components/shell/session/) · [src/lib/state/session.svelte.ts](src/lib/state/session.svelte.ts) | `/showcases/shell/session` |
| Settings (theme cookie, language, a11y) | [blueprint/app-shell/settings.md](docs/blueprint/app-shell/settings.md) | [src/lib/state/theme.svelte.ts](src/lib/state/theme.svelte.ts) | — (`/app/settings`) |
| Style randomizer (theme × typography × palette) | [foundation/style.md](docs/foundation/style.md) | [src/lib/styles/random/](src/lib/styles/random/) · [src/lib/server/style/](src/lib/server/style/) | `/showcases/shell/style` |
| Loading states (skeletons, nav progress) | [blueprint/app-shell/loading-states.md](docs/blueprint/app-shell/loading-states.md) | [src/lib/components/primitives/skeleton/](src/lib/components/primitives/skeleton/) · [NavigationProgress.svelte](src/lib/components/shell/NavigationProgress.svelte) | — |
| Empty states | [blueprint/app-shell/empty-states.md](docs/blueprint/app-shell/empty-states.md) | [src/lib/components/composites/empty-state/](src/lib/components/composites/empty-state/) | — |
| Page header (per-page, XSS-safe) | [blueprint/app-shell/page-header.md](docs/blueprint/app-shell/page-header.md) | [src/lib/components/composites/page-header/](src/lib/components/composites/page-header/) | — |
| Quick Search / command palette (two-lane FTS) | [blueprint/quick-search/](docs/blueprint/quick-search/) | [src/lib/components/composites/command-palette/](src/lib/components/composites/command-palette/) · [src/lib/server/search/](src/lib/server/search/) | — (`/search`, `GET /api/search`) |

### UI Components & Design System

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Design philosophy & three-tier theming | [blueprint/design/README.md](docs/blueprint/design/README.md) | [src/app.css](src/app.css) · [src/lib/styles/tokens.ts](src/lib/styles/tokens.ts) | — |
| Design tokens (breakpoints, fluid type/space, z-index) | [blueprint/design/tokens.md](docs/blueprint/design/tokens.md) · [stack/ui/unocss.md](docs/stack/ui/unocss.md) | [src/lib/styles/tokens.ts](src/lib/styles/tokens.ts) · [uno.config.ts](uno.config.ts) | `/showcases/ui/tokens` |
| Tonal (surface) elevation engine | [blueprint/design/tokens.md](docs/blueprint/design/tokens.md) | [src/lib/styles/elevation.ts](src/lib/styles/elevation.ts) · [src/lib/components/layout/](src/lib/components/layout/) | `/showcases/ui/layouts` |
| Component layering & CVA variants | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/](src/lib/components/) | `/showcases/ui/components` |
| Primitives (~40 Bits UI wrappers) | [blueprint/design/components.md](docs/blueprint/design/components.md) · [stack/ui/bits-ui.md](docs/stack/ui/bits-ui.md) | [src/lib/components/primitives/](src/lib/components/primitives/) | `/showcases/ui/components/primitives` |
| Composites | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/composites/](src/lib/components/composites/) | `/showcases/ui/components/composites` |
| Layout primitives (Stack, Cluster, Surface) | [blueprint/design/styling.md](docs/blueprint/design/styling.md) | [src/lib/components/layout/](src/lib/components/layout/) | `/showcases/ui/layouts` |
| Fluid responsive styling (UnoCSS, container queries) | [blueprint/design/styling.md](docs/blueprint/design/styling.md) · [stack/ui/unocss.md](docs/stack/ui/unocss.md) | [uno.config.ts](uno.config.ts) | — |
| Tables | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/primitives/table/](src/lib/components/primitives/table/) | `/showcases/ui/tables` |
| Menus (dropdown, context, menu bar) | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/composites/dropdown-menu/](src/lib/components/composites/dropdown-menu/) · [context-menu/](src/lib/components/composites/context-menu/) · [menu-bar/](src/lib/components/composites/menu-bar/) | `/showcases/ui/menus` |
| Split panes (resizable · reorderable) | [blueprint/design/components.md](docs/blueprint/design/components.md) | [src/lib/components/primitives/pane/](src/lib/components/primitives/pane/) · [src/lib/components/composites/reorderable-panes/](src/lib/components/composites/reorderable-panes/) | `/showcases/ui/splits` |
| Workbench / dock layout | [blueprint/desk/README.md](docs/blueprint/desk/README.md) | [src/lib/components/composites/dock/](src/lib/components/composites/dock/) | `/showcases/ui/workbench` |
| Typography | [blueprint/design/tokens.md](docs/blueprint/design/tokens.md) | [src/lib/components/primitives/typography/](src/lib/components/primitives/typography/) | `/showcases/ui/typography` |
| Decorative (ornaments · backgrounds) | [foundation/style.md](docs/foundation/style.md) | [src/lib/components/primitives/decorative/](src/lib/components/primitives/decorative/) | `/showcases/ui/decorative` |

### Forms & Validation

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Superforms + Valibot foundation | [blueprint/forms.md](docs/blueprint/forms.md) · [stack/forms/superforms.md](docs/stack/forms/superforms.md) | [src/lib/schemas/](src/lib/schemas/) · [src/lib/components/composites/form-field/](src/lib/components/composites/form-field/) | `/showcases/forms` |
| Basic forms (contact · settings) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/basics/contact` · `/settings` |
| Validation timing (realtime · async · server) | [blueprint/forms.md](docs/blueprint/forms.md) · [stack/forms/valibot.md](docs/stack/forms/valibot.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/validation/realtime` · `/async` · `/server` |
| Multi-step & dynamic (wizard · dynamic · dependent) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/patterns/wizard` · `/dynamic` · `/dependent` |
| Advanced (confirm · reset · edit) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/schemas/](src/lib/schemas/) | `/showcases/forms/advanced/confirm` · `/reset` · `/edit` |
| Auth forms (Better Auth client, not Superforms) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/auth-client.ts](src/lib/auth-client.ts) | `/showcases/forms/auth` |
| File uploads (withFiles + Sharp + R2) | [blueprint/forms.md](docs/blueprint/forms.md) | [src/lib/server/store/](src/lib/server/store/) | — |

### Internationalization (i18n)

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Locale routing (optional catch-all, matcher, 308 canonical) | [blueprint/i18n.md](docs/blueprint/i18n.md) | [src/params/locale.ts](src/params/locale.ts) | `/showcases/i18n` |
| Messages (Paraglide JS, ICU, compile-time) | [blueprint/i18n.md](docs/blueprint/i18n.md) · [stack/i18n/paraglide.md](docs/stack/i18n/paraglide.md) | [messages/](messages/) (generated `src/lib/paraglide/` is gitignored) | `/showcases/i18n` |
| Formatting & CLDR plural correctness | [blueprint/i18n.md](docs/blueprint/i18n.md) | [src/lib/i18n/](src/lib/i18n/) | — |
| DB content i18n (JSONB sidecar + `tc()`) | [blueprint/i18n.md](docs/blueprint/i18n.md) | [src/lib/i18n/translate.ts](src/lib/i18n/translate.ts) | — |

### Databases & Storage

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Postgres client & connection (Neon serverless) | [blueprint/db/relational.md](docs/blueprint/db/relational.md) · [stack/data/postgres.md](docs/stack/data/postgres.md) | [src/lib/server/db/index.ts](src/lib/server/db/index.ts) | `/showcases/db/relational/connection` |
| Schema & type inference (Drizzle, 14 namespaces) | [blueprint/db/relational.md](docs/blueprint/db/relational.md) · [stack/data/drizzle.md](docs/stack/data/drizzle.md) | [src/lib/server/db/schema/](src/lib/server/db/schema/) | `/showcases/db/relational/types` |
| Queries/mutations split (reads-writes duality) | [codebase-organization.md](docs/codebase-organization.md) | [src/lib/server/db/](src/lib/server/db/) | `/showcases/db/relational/mutability` |
| Neo4j connection (Aura) | [blueprint/db/graph.md](docs/blueprint/db/graph.md) · [stack/data/neo4j.md](docs/stack/data/neo4j.md) | [src/lib/server/graph/](src/lib/server/graph/) | `/showcases/db/graph/connection` |
| Graph modeling | [blueprint/db/graph.md](docs/blueprint/db/graph.md) | [src/lib/server/graph/](src/lib/server/graph/) | `/showcases/db/graph/model` |
| Graph traversal | [blueprint/db/graph.md](docs/blueprint/db/graph.md) | [src/lib/server/graph/](src/lib/server/graph/) | `/showcases/db/graph/traversal` |
| Polyglot freshness (Postgres ↔ Neo4j sync) | [blueprint/db/polyglot-freshness.md](docs/blueprint/db/polyglot-freshness.md) | [src/lib/server/graph/catalog.ts](src/lib/server/graph/catalog.ts) | — |
| Object storage (Cloudflare R2, presigned transfer) | [stack/data/r2.md](docs/stack/data/r2.md) | [src/lib/server/store/](src/lib/server/store/) | `/showcases/db/storage/connection` · `/objects` · `/transfer` |
| Cache (Upstash Redis, ephemeral patterns) | [stack/data/redis.md](docs/stack/data/redis.md) · [stack/ops/caching.md](docs/stack/ops/caching.md) | [src/lib/server/cache/](src/lib/server/cache/) | `/showcases/db/cache/connection` · `/patterns` · `/ephemeral` |

### Database Operations

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Dev→prod schema workflow (push-only, no migrations dir) | [blueprint/data/drizzle-workflow.md](docs/blueprint/data/drizzle-workflow.md) | [drizzle.config.ts](drizzle.config.ts) | — |
| Neon branch refresh from prod (control plane, run ledger) | [blueprint/data/neon-branch-refresh.md](docs/blueprint/data/neon-branch-refresh.md) | [src/lib/server/neon/](src/lib/server/neon/) · [src/lib/server/dbops/](src/lib/server/dbops/) | — (`/admin/db`) |
| DB bootstrap & seed | [blueprint/data/README.md](docs/blueprint/data/README.md) | [src/lib/server/db/seed/](src/lib/server/db/seed/) · [scripts/db/](scripts/db/) | — |

### Identity & Access

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Passwordless auth (magic link + OTP) | [blueprint/auth.md](docs/blueprint/auth.md) · [stack/auth/better-auth.md](docs/stack/auth/better-auth.md) | [src/lib/server/auth/index.ts](src/lib/server/auth/index.ts) · [src/lib/auth-client.ts](src/lib/auth-client.ts) | `/showcases/auth/authn` |
| OAuth (GitHub, Google) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/](src/lib/server/auth/) | `/showcases/auth/authn` |
| Route guards & per-route authorization | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/guards.ts](src/lib/server/auth/guards.ts) | `/showcases/auth/authz` |
| Capability grants (request → approve → expire) | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/grants.ts](src/lib/server/auth/grants.ts) · [grant-requests.ts](src/lib/server/auth/grant-requests.ts) | — |
| Passkeys & step-up TOTP | [blueprint/auth.md](docs/blueprint/auth.md) | [src/lib/server/auth/step-up.ts](src/lib/server/auth/step-up.ts) · [factor-changes.ts](src/lib/server/auth/factor-changes.ts) · [step-up-dialog/](src/lib/components/composites/step-up-dialog/) | — (`/app/account`) |
| User management | [blueprint/app-shell/user-account.md](docs/blueprint/app-shell/user-account.md) | [src/lib/server/db/user/](src/lib/server/db/user/) | `/showcases/auth/users` |

### Anti-Abuse

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| ALTCHA proof-of-work captcha | [blueprint/abuse/captcha.md](docs/blueprint/abuse/captcha.md) | [src/lib/server/abuse/altcha.ts](src/lib/server/abuse/altcha.ts) · [src/lib/components/composites/altcha/](src/lib/components/composites/altcha/) | `/showcases/abuse/captcha` |
| Honeypot (hidden field + min fill time) | [blueprint/abuse/honeypot.md](docs/blueprint/abuse/honeypot.md) | [src/lib/server/abuse/honeypot.ts](src/lib/server/abuse/honeypot.ts) | `/showcases/abuse/honeypot` |
| Rate limiting (sliding window, fail-closed) | [blueprint/abuse/rate-limits.md](docs/blueprint/abuse/rate-limits.md) | [src/lib/server/abuse/rate-limit/](src/lib/server/abuse/rate-limit/) · [src/lib/server/api/rate-limit.ts](src/lib/server/api/rate-limit.ts) | `/showcases/abuse/rate-limits` |
| AI daily token budget | [blueprint/abuse/ai-budget.md](docs/blueprint/abuse/ai-budget.md) | [src/lib/server/ai/budget.ts](src/lib/server/ai/budget.ts) | `/showcases/abuse/ai-budget` |
| Bot decision & abuse audit | [blueprint/abuse/README.md](docs/blueprint/abuse/README.md) | [src/lib/server/abuse/decision.ts](src/lib/server/abuse/decision.ts) · [audit.ts](src/lib/server/abuse/audit.ts) | `/showcases/abuse` |

### Admin & Privacy

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Admin area, guards & data-table pattern | [blueprint/admin/README.md](docs/blueprint/admin/README.md) | [src/lib/server/admin/](src/lib/server/admin/) | `/showcases/admin/powers` |
| GDPR data transparency (view · export · delete) | [blueprint/app-shell/user-account.md](docs/blueprint/app-shell/user-account.md) · [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/server/privacy/](src/lib/server/privacy/) · [src/routes/api/me/](src/routes/api/me/) | `/showcases/admin/data` · `/rights` |
| Consent & cookies | [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/state/consent.svelte.ts](src/lib/state/consent.svelte.ts) · [ConsentBanner.svelte](src/lib/components/shell/ConsentBanner.svelte) | `/showcases/admin/cookies` |
| Data retention policy & purge jobs | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) | [src/lib/server/jobs/](src/lib/server/jobs/) | `/showcases/admin/retention` |
| Cross-device debug pairing (QR + HMAC cookie) | [blueprint/admin/pairing.md](docs/blueprint/admin/pairing.md) | [src/lib/server/pairing/](src/lib/server/pairing/) | — (`/pair/[code]`) |
| Site branding lock (custom palette) | [blueprint/visual-identity-architecture.md](docs/blueprint/visual-identity-architecture.md) | [src/lib/server/branding/](src/lib/server/branding/) · [src/lib/components/branding/](src/lib/components/branding/) | — (`/admin/branding`) |
| Audit log, announcements, feature flags | [blueprint/admin/README.md](docs/blueprint/admin/README.md) | [src/lib/server/admin/](src/lib/server/admin/) | — (`/admin`) |
| Feedback capture | [blueprint/abuse/honeypot.md](docs/blueprint/abuse/honeypot.md) | [src/lib/server/feedback/](src/lib/server/feedback/) | — (`/feedback`) |

### AI

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Chat assistant "Vely" (orchestrator, streaming) | [blueprint/ai/README.md](docs/blueprint/ai/README.md) · [stack/ai/ai-sdk.md](docs/stack/ai/ai-sdk.md) | [src/lib/server/ai/chat-orchestrator.ts](src/lib/server/ai/chat-orchestrator.ts) · [src/lib/components/composites/chatbot/](src/lib/components/composites/chatbot/) | `/showcases/ai/chat` |
| Persistent minimizable chatbot session | [blueprint/ai/persistent-chatbot.md](docs/blueprint/ai/persistent-chatbot.md) | [src/lib/state/chatbot-session.svelte.ts](src/lib/state/chatbot-session.svelte.ts) | — |
| Provider registry & routing (chat/tools/vision + circuit breaker) | [blueprint/ai/provider-routing.md](docs/blueprint/ai/provider-routing.md) | [src/lib/server/ai/providers.ts](src/lib/server/ai/providers.ts) | — |
| Tool calling & catalog grounding | [blueprint/ai/surfaces.md](docs/blueprint/ai/surfaces.md) | [src/lib/server/ai/tools/](src/lib/server/ai/tools/) · [tool-leak-guard.ts](src/lib/server/ai/tool-leak-guard.ts) | — |
| Chatbot site awareness (page context) | [blueprint/ai/site-awareness.md](docs/blueprint/ai/site-awareness.md) | [src/lib/server/search/page-context.ts](src/lib/server/search/page-context.ts) | — |
| Layered RAG (llmwiki + rawrag) | [blueprint/ai/layered-rag.md](docs/blueprint/ai/layered-rag.md) | [src/lib/server/llmwiki/](src/lib/server/llmwiki/) · [src/lib/server/rawrag/](src/lib/server/rawrag/) | `/showcases/ai/retrieval` |
| Graph RAG pipeline (three tiers, RRF fusion) | [blueprint/ai/graph-rag.md](docs/blueprint/ai/graph-rag.md) | [src/lib/server/rawrag/tiers/](src/lib/server/rawrag/tiers/) · [src/lib/server/graph/rag/](src/lib/server/graph/rag/) | `/showcases/ai/retrieval/rag-chat` |
| Knowledge base & ingest | [blueprint/ai/knowledge-base.md](docs/blueprint/ai/knowledge-base.md) | [src/lib/server/rawrag/ingest/](src/lib/server/rawrag/ingest/) | `/showcases/ai/retrieval/ingest` |
| Retrieval observability (waterfall, explorer) | [blueprint/ai/nrag-observability.md](docs/blueprint/ai/nrag-observability.md) | [src/lib/server/rawrag/queries.ts](src/lib/server/rawrag/queries.ts) | `/showcases/ai/retrieval/explorer` |
| Image metadata reader (vision) | [blueprint/ai/image-metadata.md](docs/blueprint/ai/image-metadata.md) | [src/lib/server/imagemeta/](src/lib/server/imagemeta/) | `/showcases/ai/image-metadata` |
| Cost & usage monitoring | [blueprint/ai/cost-monitoring.md](docs/blueprint/ai/cost-monitoring.md) | [src/lib/server/ai/pricing.ts](src/lib/server/ai/pricing.ts) · [usage-summary.ts](src/lib/server/ai/usage-summary.ts) | — (`/admin/ai`) |
| TOON token-efficient context format | [blueprint/ai/toon.md](docs/blueprint/ai/toon.md) | [src/lib/server/ai/context/](src/lib/server/ai/context/) | — |
| Deskbot (AI in the desk workspace) | [blueprint/ai/desk-integration.md](docs/blueprint/ai/desk-integration.md) | [src/lib/server/ai/deskbot-rag.ts](src/lib/server/ai/deskbot-rag.ts) · [src/lib/server/agents/](src/lib/server/agents/) | — (`/desk`) |
| Agent-harness audit lens (loop/context/policy/tools) | [blueprint/ai/harness-lens.md](docs/blueprint/ai/harness-lens.md) | [src/lib/server/ai/loop/](src/lib/server/ai/loop/) · [policy/](src/lib/server/ai/policy/) | — |

### Toolkits

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Image Kit (upload → AI pipeline → adjust → approve, persists nothing) | [blueprint/ai/image-kit.md](docs/blueprint/ai/image-kit.md) | [src/lib/server/imagekit/](src/lib/server/imagekit/) | `/showcases/toolkits/image-kit` |

### Analytics

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Pageview collector hook (last of 12 middleware stages) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/server/analytics/hook.ts](src/lib/server/analytics/hook.ts) | `/showcases/analytics/overview` |
| Consent-gated sessions (cookieless day-rotating id) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) · [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/server/analytics/consent.ts](src/lib/server/analytics/consent.ts) | `/showcases/analytics/privacy` |
| User journeys (client beacon) | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/analytics/journey-beacon.ts](src/lib/analytics/journey-beacon.ts) | `/showcases/analytics/journeys` |
| Funnels | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/server/db/analytics/](src/lib/server/db/analytics/) | `/showcases/analytics/funnels` |
| Live events feed | [blueprint/analytics/activation.md](docs/blueprint/analytics/activation.md) | [src/lib/server/analytics/](src/lib/server/analytics/) · [src/routes/api/analytics/](src/routes/api/analytics/) | `/showcases/analytics/live` |
| Rollup & cleanup jobs | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) | [src/lib/server/jobs/analytics-rollup.ts](src/lib/server/jobs/analytics-rollup.ts) · [analytics-cleanup.ts](src/lib/server/jobs/analytics-cleanup.ts) | — |
| Visitor "my data" transparency | [stack/capabilities/gdpr.md](docs/stack/capabilities/gdpr.md) | [src/lib/server/analytics/](src/lib/server/analytics/) | `/showcases/analytics/my-data` |

### Notifications

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Router, outbox & delivery worker | [blueprint/notifications/routing.md](docs/blueprint/notifications/routing.md) | [src/lib/server/notifications/router.ts](src/lib/server/notifications/router.ts) · [outbox.ts](src/lib/server/notifications/outbox.ts) | `/showcases/notifications/pipeline` |
| Channel providers (email · Telegram · Discord) | [blueprint/notifications/channels.md](docs/blueprint/notifications/channels.md) · [stack/notifications/](docs/stack/notifications/) | [src/lib/server/notifications/providers/](src/lib/server/notifications/providers/) | `/showcases/notifications/channels` |
| In-app SSE stream & notification center | [blueprint/app-shell/notifications.md](docs/blueprint/app-shell/notifications.md) | [src/lib/server/notifications/stream.ts](src/lib/server/notifications/stream.ts) · [src/lib/state/notifications.svelte.ts](src/lib/state/notifications.svelte.ts) | `/showcases/notifications/send` |
| Settings matrix (channel × type) | [blueprint/notifications/settings.md](docs/blueprint/notifications/settings.md) | [src/lib/server/preferences/](src/lib/server/preferences/) | — (`/app/notifications`) |
| Schema & delivery log | [blueprint/notifications/schema.md](docs/blueprint/notifications/schema.md) | [src/lib/server/db/schema/notifications/](src/lib/server/db/schema/notifications/) | — |

### Jobs & Scheduling

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Job registry & runner (unified observability) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) | [src/lib/server/jobs/index.ts](src/lib/server/jobs/index.ts) · [runner.ts](src/lib/server/jobs/runner.ts) | `/showcases/jobs` |
| Platform scheduling (Vercel cron vs container `setInterval`) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) · [blueprint/deployment.md](docs/blueprint/deployment.md) | [src/lib/server/jobs/scheduler.ts](src/lib/server/jobs/scheduler.ts) · [src/routes/api/cron/](src/routes/api/cron/) · [vercel.json](vercel.json) | — |
| Registered jobs (retention, cleanup, sync, delivery) | [blueprint/architecture/jobs.md](docs/blueprint/architecture/jobs.md) | [src/lib/server/jobs/](src/lib/server/jobs/) | — (`/admin/jobs`) |

### PWA

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Localized manifest & installability | [blueprint/pwa.md](docs/blueprint/pwa.md) · [stack/capabilities/pwa.md](docs/stack/capabilities/pwa.md) | [src/routes/manifest.webmanifest/](src/routes/manifest.webmanifest/) | `/showcases/pwa` |
| Service-worker caching contract (HTML network-only, kill switch) | [blueprint/pwa.md](docs/blueprint/pwa.md) | [src/service-worker.ts](src/service-worker.ts) | `/showcases/pwa` |
| Update flow (silent + idle toast, no auto skipWaiting) | [blueprint/pwa.md](docs/blueprint/pwa.md) | [UpdatePrompt.svelte](src/lib/components/shell/UpdatePrompt.svelte) | — |
| Web push channel (declarative JSON, no PII) | [blueprint/pwa.md](docs/blueprint/pwa.md) | [src/lib/server/notifications/providers/](src/lib/server/notifications/providers/) | — |

### Data Viz

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Charts | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/chart/](src/lib/components/viz/chart/) | `/showcases/viz/charts` |
| Plots | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/plot/](src/lib/components/viz/plot/) | `/showcases/viz/plots` |
| Diagrams | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/diagram/](src/lib/components/viz/diagram/) | `/showcases/viz/diagrams` |
| Node graphs | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/graph/](src/lib/components/viz/graph/) | `/showcases/viz/graphs` |
| Maps | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/map/](src/lib/components/viz/map/) | `/showcases/viz/maps` |
| Timelines | [stack/capabilities/viz.md](docs/stack/capabilities/viz.md) | [src/lib/components/viz/timeline/](src/lib/components/viz/timeline/) | — |

### 3D

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Threlte integration (SSR-off, code-split model registry) | [blueprint/3d/3d-integration.md](docs/blueprint/3d/3d-integration.md) · [stack/capabilities/3d-web.md](docs/stack/capabilities/3d-web.md) | [src/lib/components/3d/](src/lib/components/3d/) · [src/lib/config/models.ts](src/lib/config/models.ts) | `/showcases/3d` |
| Static & animated scenes | [blueprint/3d/3d-quick-reference.md](docs/blueprint/3d/3d-quick-reference.md) | [SceneContent.svelte](src/lib/components/3d/SceneContent.svelte) | `/showcases/3d/static-scene` · `/animated-scene` |
| Full-screen model viewer & customizer (layout reset) | [blueprint/3d/3d-integration.md](docs/blueprint/3d/3d-integration.md) | [customizer/](src/lib/components/3d/customizer/) · [ViewerScene.svelte](src/lib/components/3d/ViewerScene.svelte) | — (`/showcases/3d/[model]`) |

### Content, Blog & Desk

| Pattern | Docs | Code | Showcase |
|---|---|---|---|
| Blog engine (posts, revisions, locale-aware publishing) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/server/blog/](src/lib/server/blog/) · [src/lib/components/blog/](src/lib/components/blog/) | — (`/blog`) |
| Comments (flat, per-locale, moderated) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/server/blog/](src/lib/server/blog/) | — |
| Markdown pipeline & custom syntax (directives, wikilinks) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/server/content/](src/lib/server/content/) · [src/lib/content-syntax/](src/lib/content-syntax/) | — |
| Desk workspace (panels, DeskBus, file registry) | [blueprint/desk/README.md](docs/blueprint/desk/README.md) | [src/lib/server/desk/](src/lib/server/desk/) · [src/lib/components/explorer/](src/lib/components/explorer/) | — (`/desk`) |
| Spreadsheet panel (file type, dual-mode) | [blueprint/desk/spreadsheet.md](docs/blueprint/desk/spreadsheet.md) | [src/lib/components/spreadsheet/](src/lib/components/spreadsheet/) | — |
| Markdown editor (CodeMirror, slash commands) | [blueprint/blog.md](docs/blueprint/blog.md) | [src/lib/components/editor/](src/lib/components/editor/) | — |
| Prerendered docs site | [blueprint/pages.md](docs/blueprint/pages.md) | [src/lib/server/docs/](src/lib/server/docs/) | — (`/docs`) |

### Maintaining this index

This index is hand-maintained. Its coverage source of truth is [src/lib/showcases/registry.ts](src/lib/showcases/registry.ts) — a new showcase area there means a new `###` section here; a new sublink means a new row. Other drift points: a new `docs/blueprint/<area>/` directory (new Docs links + a row in [blueprint/README.md](docs/blueprint/README.md)), a new `src/lib/server/<domain>/` module (new Code cell), a renamed route (Showcase cells).
