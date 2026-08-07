# Pattern Library

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

One page per pattern record — 136 patterns (11 deep cards / 125 index rows) across 20 categories. Each page points to the docs that explain the pattern, the code that implements it, and the showcase that proves it; **bold** entries are deep-tier cards with invariants and emulation notes.

This README is the GitHub navigation hub; in-app, this directory is the Pattern Library docs section — the catalog lives at `/docs/pattern-library` and every page below at `/docs/pattern-library/<id>`.

### Architecture & Request Pipeline

- [**Multi-client core (hexagonal domain modules)**](./multi-client-core.md)
- [Runtime layers & request flow (7-layer view)](./architecture-runtime-layers.md)
- [Codebase map ("where does X live")](./architecture-codebase-map.md)
- [Middleware / 12-stage hook chain (CSRF, headers, guards)](./architecture-middleware.md)
- [REST API patterns (pagination, envelopes, rate limits)](./architecture-rest-api.md)
- [Error handling (expected/unexpected/form/API)](./architecture-error-handling.md)
- [State management (Svelte 5 runes)](./architecture-state-management.md)
- [Request-cycle visualizer (form · API · AI)](./architecture-request-cycle-visualizer.md)
- [Deployment (Vercel primary, tri-target)](./architecture-deployment.md)
- [Testing infrastructure (Vitest, PGlite isolation)](./architecture-testing-infra.md)
- [Pattern MCP (agent-queryable pattern registry, local stdio)](./architecture-pattern-mcp.md)
- [Hosted MCP (two trust surfaces: public read-only · bearer admin)](./architecture-hosted-mcp.md)

### App Shell & Navigation

- [Shell layout (no global header, sidebar-first)](./app-shell-layout.md)
- [Responsive sidebar (rail / drawer / FAB)](./app-shell-sidebar.md)
- [Navigation structure & progressive disclosure](./app-shell-navigation.md)
- [Keyboard shortcuts registry + help modal](./app-shell-keyboard-shortcuts.md)
- [Modals & layer stack](./app-shell-modals.md)
- [Toasts (stacking, undo)](./app-shell-toasts.md)
- [Session lifecycle UI (expiry, re-auth)](./app-shell-session-lifecycle.md)
- [Settings (theme cookie, language, a11y)](./app-shell-settings.md)
- [Style randomizer (theme × typography × palette)](./app-shell-style-randomizer.md)
- [Loading states (skeletons, nav progress)](./app-shell-loading-states.md)
- [Empty states](./app-shell-empty-states.md)
- [Page header (per-page, XSS-safe)](./app-shell-page-header.md)
- [Quick Search / command palette (two-lane FTS)](./app-shell-quick-search.md)

### UI Components & Design System

- [**Component-first UI system (primitives/composites/layout, CVA, tokens)**](./ui-component-system.md)
- [Design philosophy & three-tier theming](./ui-design-philosophy.md)
- [Design tokens (breakpoints, fluid type/space, z-index)](./ui-design-tokens.md)
- [Tonal (surface) elevation engine](./ui-tonal-elevation.md)
- [Primitives (~40 Bits UI wrappers)](./ui-primitives.md)
- [Composites](./ui-composites.md)
- [Layout primitives (Stack, Cluster, Surface)](./ui-layout-primitives.md)
- [Fluid responsive styling (UnoCSS, container queries)](./ui-fluid-styling.md)
- [Tables](./ui-tables.md)
- [Menus (dropdown, context, menu bar)](./ui-menus.md)
- [Split panes (resizable · reorderable)](./ui-split-panes.md)
- [Workbench / dock layout](./ui-workbench.md)
- [Typography](./ui-typography.md)
- [Decorative (ornaments · backgrounds)](./ui-decorative.md)

### Forms & Validation

- [Superforms + Valibot foundation](./forms-superforms-valibot.md)
- [Basic forms (contact · settings)](./forms-basic-forms.md)
- [Validation timing (realtime · async · server)](./forms-validation-timing.md)
- [Multi-step & dynamic (wizard · dynamic · dependent)](./forms-multi-step-dynamic.md)
- [Advanced (confirm · reset · edit)](./forms-advanced-patterns.md)
- [Auth forms (Better Auth client, not Superforms)](./forms-auth-forms.md)
- [File uploads (withFiles + Sharp + R2)](./forms-file-uploads.md)

### Internationalization (i18n)

- [Locale routing (optional catch-all, matcher, 308 canonical)](./i18n-locale-routing.md)
- [Messages (Paraglide JS, ICU, compile-time)](./i18n-messages.md)
- [Formatting & CLDR plural correctness](./i18n-formatting.md)
- [DB content i18n (JSONB sidecar + `tc()`)](./i18n-db-content.md)

### Docs & Agent Experience

- [**Docs navigation hubs (README-per-directory convention)**](./docs-nav-hubs.md)
- [**Pattern Index (the generated README capability map)**](./pattern-index.md)
- [**Agent Experience (AX) surfaces**](./agent-experience.md)

### Databases & Storage

- [Postgres client & connection (Neon serverless)](./databases-postgres-connection.md)
- [Schema & type inference (Drizzle, 14 namespaces)](./databases-schema-type-inference.md)
- [Queries/mutations split (reads-writes duality)](./databases-queries-mutations-split.md)
- [Neo4j connection (Aura)](./databases-neo4j-connection.md)
- [Graph modeling](./databases-graph-modeling.md)
- [Graph traversal](./databases-graph-traversal.md)
- [Polyglot freshness (Postgres ↔ Neo4j sync)](./databases-polyglot-freshness.md)
- [Object storage (Cloudflare R2, presigned transfer)](./databases-object-storage.md)
- [Cache (Upstash Redis, ephemeral patterns)](./databases-cache.md)

### Database Operations

- [Dev→prod schema workflow (push-only, no migrations dir)](./db-ops-dev-prod-schema-workflow.md)
- [Neon branch refresh from prod (control plane, run ledger)](./db-ops-branch-refresh.md)
- [DB bootstrap & seed](./db-ops-bootstrap-seed.md)

### Identity & Access

- [Passwordless auth (magic link + OTP)](./identity-passwordless-auth.md)
- [OAuth (GitHub, Google)](./identity-oauth.md)
- [Route guards & per-route authorization](./identity-route-guards.md)
- [Capability grants (request → approve → expire)](./identity-capability-grants.md)
- [Passkeys & step-up TOTP](./identity-passkeys.md)
- [User management](./identity-user-management.md)

### Anti-Abuse

- [ALTCHA proof-of-work captcha](./anti-abuse-captcha.md)
- [Honeypot (hidden field + min fill time)](./anti-abuse-honeypot.md)
- [Rate limiting (sliding window, fail-closed)](./anti-abuse-rate-limiting.md)
- [AI daily token budget](./anti-abuse-ai-budget.md)
- [Bot decision & abuse audit](./anti-abuse-bot-decision-audit.md)

### Admin & Privacy

- [Admin area, guards & data-table pattern](./admin-privacy-admin-area.md)
- [GDPR data transparency (view · export · delete)](./admin-privacy-gdpr.md)
- [Consent & cookies](./admin-privacy-consent-cookies.md)
- [Data retention policy & purge jobs](./admin-privacy-data-retention.md)
- [Cross-device debug pairing (QR + HMAC cookie)](./admin-privacy-pairing.md)
- [Style picking + custom palettes](./admin-privacy-style-picking.md)
- [Audit log, announcements, feature flags](./admin-privacy-audit-log.md)
- [Feedback capture](./admin-privacy-feedback.md)

### AI

- [**AI tool manifest & harness split (tool defs, risk metadata, registry)**](./ai-tool-harness.md)
- [**AI surfaces (chatbot vs deskbot split over one guard)**](./ai-surfaces.md)
- [**Deskbot approval gate (proposal → approve, plan-gated mutation)**](./deskbot-approval-gate.md)
- [**Layered RAG (llmwiki pointer layer over a rawrag kernel)**](./layered-rag.md)
- [**Retrieval ingest/search endpoints (one ingest door, /api/retrieval/*)**](./retrieval-endpoints.md)
- [Chat assistant "Vely" (orchestrator, streaming)](./ai-chat-assistant.md)
- [Persistent minimizable chatbot session](./ai-chatbot-session.md)
- [Provider registry & routing (chat/tools/vision + circuit breaker)](./ai-provider-routing.md)
- [Chatbot site awareness (page context)](./ai-site-awareness.md)
- [Graph RAG pipeline (three tiers, RRF fusion)](./ai-graph-rag.md)
- [Retrieval observability (waterfall, explorer)](./ai-retrieval-observability.md)
- [Image metadata reader (vision)](./ai-image-metadata.md)
- [Cost & usage monitoring](./ai-cost-monitoring.md)
- [TOON token-efficient context format](./ai-toon-format.md)
- [Deskbot (AI in the desk workspace)](./ai-deskbot.md)
- [Agent-harness audit lens (loop/context/policy/tools)](./ai-harness-lens.md)

### Toolkits

- [Image Kit (upload → AI pipeline → adjust → approve, persists nothing)](./toolkits-image-kit.md)

### Analytics

- [Pageview collector hook (last of 12 middleware stages)](./analytics-pageview-hook.md)
- [Consent-gated sessions (cookieless day-rotating id)](./analytics-consent-sessions.md)
- [User journeys (client beacon)](./analytics-journeys.md)
- [Funnels](./analytics-funnels.md)
- [Live events feed](./analytics-live-feed.md)
- [Rollup & cleanup jobs](./analytics-rollup-cleanup.md)
- [Visitor "my data" transparency](./analytics-my-data-transparency.md)

### Notifications

- [Router, outbox & delivery worker](./notifications-router-outbox.md)
- [Channel providers (email · Telegram · Discord)](./notifications-channels.md)
- [In-app SSE stream & notification center](./notifications-sse-stream.md)
- [Settings matrix (channel × type)](./notifications-settings-matrix.md)
- [Schema & delivery log](./notifications-schema-delivery-log.md)

### Jobs & Scheduling

- [**Jobs & scheduling (registry, runner, platform-owned cadence)**](./jobs-scheduler.md)
- [Platform scheduling (Vercel cron vs container `setInterval`)](./jobs-platform-scheduling.md)
- [Registered jobs (retention, cleanup, sync, delivery)](./jobs-registered-catalog.md)

### PWA

- [Localized manifest & installability](./pwa-manifest.md)
- [Service-worker caching contract (HTML network-only, kill switch)](./pwa-service-worker.md)
- [Update flow (silent + idle toast, no auto skipWaiting)](./pwa-update-flow.md)
- [Web push channel (declarative JSON, no PII)](./pwa-web-push.md)

### Data Viz

- [Charts](./viz-charts.md)
- [Plots](./viz-plots.md)
- [Diagrams](./viz-diagrams.md)
- [Node graphs](./viz-graphs.md)
- [Maps](./viz-maps.md)
- [Timelines](./viz-timelines.md)

### 3D

- [Threlte integration (SSR-off, code-split model registry)](./3d-threlte-integration.md)
- [Static & animated scenes](./3d-static-animated-scenes.md)
- [Full-screen model viewer & customizer (layout reset)](./3d-model-viewer-customizer.md)

### Content, Blog & Desk

- [Blog engine (posts, revisions, locale-aware publishing)](./content-blog-engine.md)
- [Comments (flat, per-locale, moderated)](./content-comments.md)
- [Markdown pipeline & custom syntax (directives, wikilinks)](./content-markdown-pipeline.md)
- [Desk workspace (panels, DeskBus, file registry)](./content-desk-workspace.md)
- [Spreadsheet panel (file type, dual-mode)](./content-spreadsheet-panel.md)
- [Markdown editor (CodeMirror, slash commands)](./content-markdown-editor.md)
- [Prerendered docs site](./content-docs-site.md)
