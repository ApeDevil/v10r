# Pattern Library

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

One page per pattern record — 170 patterns (64 deep cards / 106 index rows) across 29 categories. Each page points to the docs that explain the pattern, the code that implements it, and the showcase that proves it; **bold** entries are deep-tier cards with invariants and emulation notes.

This README is the GitHub navigation hub; in-app, this directory is the Pattern Library docs section — the catalog lives at `/docs/pattern-library` and every page below at `/docs/pattern-library/<id>`.

### Architecture & Request Pipeline

- [**Multi-client core**](./multi-client-core.md)
- [Middleware hook chain](./middleware-hook-chain.md)
- [REST API conventions](./rest-api-conventions.md)
- [Error handling](./error-handling.md)
- [State management](./state-management.md)
- [Deployment target](./deployment-target.md)
- [Testing infrastructure](./testing-infrastructure.md)
- [Pattern MCP](./pattern-mcp.md)
- [Hosted MCP](./hosted-mcp.md)
- [**MCP protocol evolution**](./mcp-protocol-evolution.md)
- [**MCP authorization**](./mcp-authorization.md)
- [**Agentic architecture**](./agentic-architecture.md)
- [WebAssembly compute kernel](./wasm-compute-kernel.md)
- [**External service runtime**](./external-service-runtime.md)
- [**Architecture Engineering**](./architecture-engineering.md)
- [**URL state**](./url-search-state.md)

### App Shell & Navigation

- [Shell layout](./app-shell-layout.md)
- [Responsive sidebar](./responsive-sidebar.md)
- [Navigation structure & progressive disclosure](./navigation-structure.md)
- [Keyboard shortcuts registry + help modal](./keyboard-shortcuts.md)
- [Modals & layer stack](./modal-layer-stack.md)
- [Toasts](./toasts.md)
- [Session lifecycle UI](./session-lifecycle-ui.md)
- [Loading states](./loading-states.md)
- [Empty states](./empty-states.md)
- [Page header](./page-header.md)
- [Quick search command palette](./command-palette.md)
- [Visitor style resolution](./visitor-style-resolution.md)

### UI Components & Design System

- [**Component-first UI system**](./component-system.md)
- [Design philosophy & three-tier theming](./design-philosophy.md)
- [**Explosive Discovery — nested depth for dense menus and pages**](./explosive-discovery.md)
- [**Latent Cards — actions that rest neutral and wake on intent**](./latent-cards.md)
- [Design tokens](./design-tokens.md)
- [Tonal elevation engine](./tonal-elevation.md)
- [Fluid responsive styling](./fluid-styling.md)

### Forms & Validation

- [Schema-validated forms](./schema-validated-forms.md)
- [Validation timing](./validation-timing.md)
- [Multi-step and dynamic forms](./multi-step-forms.md)
- [Auth forms](./auth-forms.md)
- [File uploads](./file-uploads.md)
- [**Dynamic attributes**](./dynamic-attributes.md)
- [**Form draft recovery**](./form-draft-recovery.md)

### Internationalization (i18n)

- [Locale routing](./locale-routing.md)
- [Translated messages](./translated-messages.md)
- [Formatting & CLDR plural correctness](./locale-formatting.md)
- [Translated database content](./translated-database-content.md)

### Docs & Agent Experience

- [**Docs navigation hubs**](./docs-nav-hubs.md)
- [**Pattern Index**](./pattern-index.md)
- [**Agent experience surfaces**](./agent-experience.md)
- [**Agent Skills generated from the pattern registry**](./agent-skills.md)

### Databases & Storage

- [Postgres client and connection](./postgres-connection.md)
- [Schema and type inference](./schema-type-inference.md)
- [Queries/mutations split](./queries-mutations-split.md)
- [Neo4j connection](./neo4j-connection.md)
- [Graph modeling](./graph-modeling.md)
- [Graph traversal](./graph-traversal.md)
- [Polyglot freshness](./polyglot-freshness.md)
- [Object storage adapter](./object-storage-adapter.md)
- [Temporal data modeling](./temporal-data-modeling.md)

### Database Operations

- [Dev-to-prod schema workflow](./dev-to-prod-schema-workflow.md)
- [Database branch refresh from production](./database-branch-refresh.md)
- [Database bootstrap and seed](./database-bootstrap-seed.md)

### Identity & Access

- [Passwordless auth](./passwordless-auth.md)
- [OAuth sign-in](./oauth-sign-in.md)
- [Route guards & per-route authorization](./route-guards.md)
- [Grant requests](./grant-requests.md)
- [Passkeys & step-up TOTP](./passkeys.md)

### Anti-Abuse

- [ALTCHA proof-of-work captcha](./proof-of-work-captcha.md)
- [Honeypot](./honeypot.md)
- [Rate limiting](./rate-limiting.md)
- [AI daily token budget](./ai-token-budget.md)
- [Bot decision & abuse audit](./bot-decision-audit.md)

### Admin & Privacy

- [Admin area, guards & data-table pattern](./admin-area.md)
- [GDPR data rights](./gdpr-data-rights.md)
- [Consent & cookies](./consent-cookies.md)
- [Data retention policy & purge jobs](./data-retention.md)
- [Cross-device debug pairing](./debug-pairing.md)
- [Audit log](./audit-log.md)
- [**Encryption key ring**](./encryption-key-ring.md)

### AI

- [**AI tool manifest and harness split**](./ai-tool-harness.md)
- [**AI surfaces**](./ai-surfaces.md)
- [**Deskbot approval gate**](./deskbot-approval-gate.md)
- [**Grounded retrieval with a corpus map**](./layered-rag.md)
- [**Retrieval ingest/search endpoints**](./retrieval-endpoints.md)
- [Persistent minimizable chatbot session](./chatbot-session.md)
- [Provider registry & routing](./provider-routing.md)
- [Chatbot site awareness](./chatbot-site-awareness.md)
- [Graph RAG pipeline](./graph-rag.md)
- [Turn trace and turn graph](./turn-trace.md)
- [Image metadata reader](./image-metadata-reader.md)
- [Cost & usage monitoring](./ai-cost-monitoring.md)
- [TOON token-efficient context format](./toon-context-format.md)
- [Deskbot](./ai-deskbot.md)
- [Agent-harness audit lens](./agent-harness-lens.md)
- [**Untrusted-content boundary**](./untrusted-content-boundary.md)
- [**Agent actions**](./agent-actions.md)
- [**MCP client**](./mcp-client.md)
- [**MCP App provider**](./mcp-app-provider.md)
- [**Agent to agent**](./agent-to-agent.md)
- [**Generative UI**](./generative-ui.md)
- [WebMCP publication of client actions](./webmcp.md)
- [AG-UI endpoint over the turn stream](./ag-ui-endpoint.md)
- [Turn trace as OpenTelemetry GenAI spans](./agent-observability.md)
- [**AI eval regression suite**](./ai-eval-regression-suite.md)

### Office Workflows

- [**PIM sheet transform with AI agents**](./pim-sheet-transform.md)

### Analytics

- [Pageview collector hook](./pageview-collector.md)
- [Consent-gated sessions](./consent-gated-sessions.md)
- [User journeys](./user-journeys.md)
- [Funnels](./funnels.md)
- [Rollup & cleanup jobs](./analytics-rollups.md)

### Notifications

- [Notification router, outbox and delivery worker](./notification-outbox.md)
- [Channel providers](./notification-channels.md)
- [In-app SSE stream & notification center](./notification-stream.md)
- [Settings matrix](./notification-settings-matrix.md)

### Jobs & Scheduling

- [**Jobs and scheduling**](./job-scheduling.md)

### PWA

- [Localized manifest & installability](./web-app-manifest.md)
- [Service-worker caching contract](./service-worker-caching.md)
- [Update flow](./pwa-update-flow.md)
- [Web push channel](./web-push.md)

### Data Viz

- [Data visualization](./data-visualization.md)
- [Node graphs](./node-graph-layout.md)

### 3D

- [Threlte integration](./threlte-integration.md)
- [Full-screen model viewer and customizer](./model-viewer-customizer.md)
- [**Product composition engine**](./product-connection-engine.md)
- [**Asset production pipeline**](./asset-production-pipeline.md)
- [**Agentic parametric modeling**](./agentic-parametric-modeling.md)

### Content & Blog

- [Blog engine](./blog-engine.md)
- [Comments](./comments.md)
- [Markdown pipeline and custom syntax](./markdown-pipeline.md)
- [Markdown editor](./markdown-editor.md)
- [Prerendered docs site](./prerendered-docs-site.md)

### Desk Workspace

- [**Desk workspace**](./desk-workspace.md)
- [Spreadsheet panel](./desk-spreadsheet-panel.md)
- [Desk mobile chrome](./desk-mobile-chrome.md)
- [Composed panel menus](./desk-panel-menus.md)
- [AI desk effects](./desk-ai-effects.md)
- [Explorer panel](./desk-explorer.md)

### External Integrations

- [**Multi-source aggregation**](./multi-source-aggregation.md)
- [**Name check**](./name-check.md)

### Interaction Velocity

- [**Optimistic mutation**](./optimistic-mutation.md)
- [**Intent-based preloading**](./intent-preloading.md)
- [**Virtualized rendering**](./virtualized-rendering.md)
- [Idle and speculative work](./idle-work.md)

### Data Velocity

- [**Hierarchical cache**](./hierarchical-cache.md)
- [**Stale-while-revalidate**](./stale-while-revalidate.md)
- [**Singleflight stampede protection**](./singleflight.md)
- [**No-waterfall data loading**](./no-waterfall-loading.md)
- [Screen read model](./screen-read-model.md)
- [**Query budget and N+1 proof**](./query-budget.md)

### Runtime Velocity

- [**Critical path / deferred tail**](./critical-path-deferred-tail.md)
- [**Critical rendering path**](./critical-rendering-path.md)
- [**Heavy dependency quarantine**](./heavy-dependency-quarantine.md)
- [**Side-effect-free component tree**](./side-effect-free-components.md)
- [**Main-thread budget**](./main-thread-budget.md)
- [**Resilience policy**](./resilience-policy.md)
- [**Asset delivery pipeline**](./asset-delivery-pipeline.md)
- [Compute and data locality](./compute-locality.md)
- [**Deadline propagation**](./deadline-propagation.md)

### Velocity Measurement

- [**Latency tracing**](./latency-tracing.md)
- [**Performance budget and ratchet**](./performance-budget-ratchet.md)
- [**Performance scenario harness**](./scenario-harness.md)

### Truth & Evidence

- [Resource anchor integrity](./resource-anchor-integrity.md)
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
