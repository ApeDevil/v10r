# Pattern Library

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

One page per pattern record — 199 patterns (63 deep cards / 136 index rows) across 30 categories. Each page points to the docs that explain the pattern, the code that implements it, and the showcase that proves it; **bold** entries are deep-tier cards with invariants and emulation notes.

This README is the GitHub navigation hub; in-app, this directory is the Pattern Library docs section — the catalog lives at `/docs/pattern-library` and every page below at `/docs/pattern-library/<id>`.

### Architecture & Request Pipeline

- [**Multi-client core**](./multi-client-core.md)
- [Runtime layers and request flow](./architecture-runtime-layers.md)
- [Codebase map](./architecture-codebase-map.md)
- [Middleware hook chain](./architecture-middleware.md)
- [REST API patterns](./architecture-rest-api.md)
- [Error handling](./architecture-error-handling.md)
- [State management](./architecture-state-management.md)
- [Request-cycle visualizer](./architecture-request-cycle-visualizer.md)
- [Deployment](./architecture-deployment.md)
- [Testing infrastructure](./architecture-testing-infra.md)
- [Pattern MCP](./architecture-pattern-mcp.md)
- [Hosted MCP](./architecture-hosted-mcp.md)
- [**MCP protocol evolution**](./architecture-mcp-evolution.md)
- [**Authenticated MCP services**](./architecture-mcp-authorization.md)
- [**Agentic architecture**](./architecture-agentic-architecture.md)
- [WebAssembly compute kernel](./architecture-wasm-kernel.md)
- [**External service runtime**](./architecture-external-service.md)
- [**Architecture Engineering**](./architecture-engineering.md)
- [**URL state**](./url-search-state.md)

### App Shell & Navigation

- [Shell layout](./app-shell-layout.md)
- [Responsive sidebar](./app-shell-sidebar.md)
- [Navigation structure & progressive disclosure](./app-shell-navigation.md)
- [Keyboard shortcuts registry + help modal](./app-shell-keyboard-shortcuts.md)
- [Modals & layer stack](./app-shell-modals.md)
- [Toasts](./app-shell-toasts.md)
- [Session lifecycle UI](./app-shell-session-lifecycle.md)
- [Settings page](./app-shell-settings.md)
- [Style randomizer](./app-shell-style-randomizer.md)
- [Loading states](./app-shell-loading-states.md)
- [Empty states](./app-shell-empty-states.md)
- [Page header](./app-shell-page-header.md)
- [Quick search command palette](./app-shell-quick-search.md)

### UI Components & Design System

- [**Component-first UI system**](./ui-component-system.md)
- [Design philosophy & three-tier theming](./ui-design-philosophy.md)
- [**Explosive Discovery — nested depth for dense menus and pages**](./ui-explosive-discovery.md)
- [**Latent Cards — actions that rest neutral and wake on intent**](./ui-latent-cards.md)
- [Design tokens](./ui-design-tokens.md)
- [Tonal elevation engine](./ui-tonal-elevation.md)
- [UI primitives](./ui-primitives.md)
- [Composites](./ui-composites.md)
- [Layout primitives](./ui-layout-primitives.md)
- [Fluid responsive styling](./ui-fluid-styling.md)
- [Tables](./ui-tables.md)
- [Menus](./ui-menus.md)
- [Split panes](./ui-split-panes.md)
- [Typography](./ui-typography.md)
- [Decorative ornaments and backgrounds](./ui-decorative.md)

### Forms & Validation

- [Superforms + Valibot foundation](./forms-superforms-valibot.md)
- [Basic forms](./forms-basic-forms.md)
- [Validation timing](./forms-validation-timing.md)
- [Multi-step and dynamic forms](./forms-multi-step-dynamic.md)
- [Advanced form tactics](./forms-advanced-patterns.md)
- [Auth forms](./forms-auth-forms.md)
- [File uploads](./forms-file-uploads.md)
- [**Dynamic attributes**](./dynamic-attributes.md)
- [**Form draft recovery**](./form-draft-recovery.md)

### Internationalization (i18n)

- [Locale routing](./i18n-locale-routing.md)
- [Translated messages](./i18n-messages.md)
- [Formatting & CLDR plural correctness](./i18n-formatting.md)
- [Translated database content](./i18n-db-content.md)

### Docs & Agent Experience

- [**Docs navigation hubs**](./docs-nav-hubs.md)
- [**Pattern Index**](./pattern-index.md)
- [**Agent experience surfaces**](./agent-experience.md)
- [Resource anchor integrity](./resource-anchor-integrity.md)
- [**Agent Skills generated from the pattern registry**](./ai-agent-skills.md)

### Databases & Storage

- [Postgres client and connection](./databases-postgres-connection.md)
- [Schema and type inference](./databases-schema-type-inference.md)
- [Queries/mutations split](./databases-queries-mutations-split.md)
- [Neo4j connection](./databases-neo4j-connection.md)
- [Graph modeling](./databases-graph-modeling.md)
- [Graph traversal](./databases-graph-traversal.md)
- [Polyglot freshness](./databases-polyglot-freshness.md)
- [Object storage](./databases-object-storage.md)
- [Redis cache client](./databases-cache.md)
- [Temporal data modeling](./temporal-data-modeling.md)

### Database Operations

- [Dev-to-prod schema workflow](./db-ops-dev-prod-schema-workflow.md)
- [Neon branch refresh from prod](./db-ops-branch-refresh.md)
- [DB bootstrap & seed](./db-ops-bootstrap-seed.md)

### Identity & Access

- [Passwordless auth](./identity-passwordless-auth.md)
- [OAuth](./identity-oauth.md)
- [Route guards & per-route authorization](./identity-route-guards.md)
- [Capability grants](./identity-capability-grants.md)
- [Passkeys & step-up TOTP](./identity-passkeys.md)
- [User management](./identity-user-management.md)

### Anti-Abuse

- [ALTCHA proof-of-work captcha](./anti-abuse-captcha.md)
- [Honeypot](./anti-abuse-honeypot.md)
- [Rate limiting](./anti-abuse-rate-limiting.md)
- [AI daily token budget](./anti-abuse-ai-budget.md)
- [Bot decision & abuse audit](./anti-abuse-bot-decision-audit.md)

### Admin & Privacy

- [Admin area, guards & data-table pattern](./admin-privacy-admin-area.md)
- [GDPR data transparency](./admin-privacy-gdpr.md)
- [Consent & cookies](./admin-privacy-consent-cookies.md)
- [Data retention policy & purge jobs](./admin-privacy-data-retention.md)
- [Cross-device debug pairing](./admin-privacy-pairing.md)
- [Style picking + custom palettes](./admin-privacy-style-picking.md)
- [Audit log and announcements](./admin-privacy-audit-log.md)
- [Feedback capture](./admin-privacy-feedback.md)
- [**Encryption key ring**](./encryption-key-ring.md)

### AI

- [**AI tool manifest and harness split**](./ai-tool-harness.md)
- [**AI surfaces**](./ai-surfaces.md)
- [**Deskbot approval gate**](./deskbot-approval-gate.md)
- [**Grounded retrieval with a corpus map**](./layered-rag.md)
- [**Retrieval ingest/search endpoints**](./retrieval-endpoints.md)
- [Chat assistant](./ai-chat-assistant.md)
- [Persistent minimizable chatbot session](./ai-chatbot-session.md)
- [Provider registry & routing](./ai-provider-routing.md)
- [Chatbot site awareness](./ai-site-awareness.md)
- [Graph RAG pipeline](./ai-graph-rag.md)
- [Turn trace and turn graph](./ai-turn-trace.md)
- [Image metadata reader](./ai-image-metadata.md)
- [Cost & usage monitoring](./ai-cost-monitoring.md)
- [TOON token-efficient context format](./ai-toon-format.md)
- [Deskbot](./ai-deskbot.md)
- [Agent-harness audit lens](./ai-harness-lens.md)
- [**Untrusted-content boundary**](./ai-untrusted-content-boundary.md)
- [**Agent actions**](./ai-agent-actions.md)
- [**MCP client**](./ai-mcp-client.md)
- [**MCP App provider**](./ai-mcp-app-provider.md)
- [**Agent to agent**](./ai-agent-to-agent.md)
- [**Generative UI**](./ai-generative-ui.md)
- [WebMCP publication of client actions](./ai-webmcp.md)
- [AG-UI endpoint over the turn stream](./ai-agent-user-interaction.md)
- [Turn trace as OpenTelemetry GenAI spans](./ai-agent-observability.md)
- [**AI eval regression suite**](./ai-eval-regression-suite.md)

### Toolkits

- [Image Kit](./toolkits-image-kit.md)

### Office Workflows

- [**PIM sheet transform with AI agents**](./pim-sheet-transform-recipe.md)

### Analytics

- [Pageview collector hook](./analytics-pageview-hook.md)
- [Consent-gated sessions](./analytics-consent-sessions.md)
- [User journeys](./analytics-journeys.md)
- [Funnels](./analytics-funnels.md)
- [Live events feed](./analytics-live-feed.md)
- [Rollup & cleanup jobs](./analytics-rollup-cleanup.md)
- [Visitor "my data" transparency](./analytics-my-data-transparency.md)

### Notifications

- [Notification router, outbox and delivery worker](./notifications-router-outbox.md)
- [Channel providers](./notifications-channels.md)
- [In-app SSE stream & notification center](./notifications-sse-stream.md)
- [Settings matrix](./notifications-settings-matrix.md)
- [Schema & delivery log](./notifications-schema-delivery-log.md)

### Jobs & Scheduling

- [**Jobs and scheduling**](./jobs-scheduler.md)
- [Platform scheduling](./jobs-platform-scheduling.md)
- [Registered jobs](./jobs-registered-catalog.md)

### PWA

- [Localized manifest & installability](./pwa-manifest.md)
- [Service-worker caching contract](./pwa-service-worker.md)
- [Update flow](./pwa-update-flow.md)
- [Web push channel](./pwa-web-push.md)

### Data Viz

- [Charts](./viz-charts.md)
- [Plots](./viz-plots.md)
- [Diagrams](./viz-diagrams.md)
- [Node graphs](./viz-graphs.md)
- [Maps](./viz-maps.md)
- [Timelines](./viz-timelines.md)

### 3D

- [Threlte integration](./3d-threlte-integration.md)
- [Static & animated scenes](./3d-static-animated-scenes.md)
- [Full-screen model viewer and customizer](./3d-model-viewer-customizer.md)
- [**Product composition engine**](./product-connection-engine.md)
- [**Asset production pipeline**](./asset-production-pipeline.md)
- [**Agentic parametric modeling**](./agentic-parametric-modeling.md)

### Content & Blog

- [Blog engine](./content-blog-engine.md)
- [Comments](./content-comments.md)
- [Markdown pipeline and custom syntax](./content-markdown-pipeline.md)
- [Markdown editor](./content-markdown-editor.md)
- [Prerendered docs site](./content-docs-site.md)

### Desk Workspace

- [**Desk workspace**](./desk-workspace.md)
- [Spreadsheet panel](./desk-spreadsheet-panel.md)
- [Desk mobile chrome](./desk-mobile-chrome.md)
- [Composed panel menus](./desk-panel-menus.md)
- [AI desk effects](./desk-ai-effects.md)
- [Explorer panel](./desk-explorer.md)

### External Integrations

- [**Name check**](./name-check.md)

### Interaction Velocity

- [**Optimistic mutation**](./optimistic-mutation.md)
- [**Intent-based preloading**](./intent-preloading.md)
- [**Virtualized rendering**](./virtualized-rendering.md)
- [Idle and speculative work](./velocity-idle-work.md)

### Data Velocity

- [**Hierarchical cache**](./hierarchical-cache.md)
- [**Stale-while-revalidate**](./stale-while-revalidate.md)
- [**Singleflight stampede protection**](./singleflight.md)
- [**No-waterfall data loading**](./no-waterfall-loading.md)
- [Screen read model](./velocity-screen-read-model.md)
- [**Query budget and N+1 proof**](./query-budget.md)

### Runtime Velocity

- [**Critical path / deferred tail**](./critical-path-deferred-tail.md)
- [**Critical rendering path**](./critical-rendering-path.md)
- [**Heavy dependency quarantine**](./heavy-dependency-quarantine.md)
- [**Side-effect-free component tree**](./side-effect-free-components.md)
- [**Main-thread budget**](./main-thread-budget.md)
- [**Resilience policy**](./resilience-policy.md)
- [**Asset delivery pipeline**](./velocity-asset-delivery.md)
- [Compute and data locality](./velocity-compute-locality.md)
- [**Deadline propagation**](./deadline-propagation.md)

### Velocity Measurement

- [**Latency tracing**](./latency-tracing.md)
- [**Performance budget and ratchet**](./performance-budget-ratchet.md)
- [**Performance scenario harness**](./scenario-harness.md)

### Truth & Evidence

- [**Source-of-truth gate**](./source-of-truth-gate.md)
- [**Evidence status dimensions**](./evidence-status-dimensions.md)
- [**Asset rights manifest**](./asset-rights-manifest.md)

### Derivation & Provenance

- [**Derivation key**](./derivation-key.md)
- [**Reproducible artifact build**](./reproducible-artifact-build.md)
- [**Provenance record**](./provenance-record.md)

### Durable Execution

- [**Durable step execution**](./durable-step-execution.md)
- [**Versioned document session**](./versioned-document-session.md)
