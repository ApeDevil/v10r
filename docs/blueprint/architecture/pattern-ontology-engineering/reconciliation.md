# D. Pattern reconciliation — all 199 records

Generated for the review from `registry.json` 2.2.0 at commit 5720c96 plus the reviewer's annotations. Every record is listed. Columns: current tier/maturity, current `requires`, proposed **kind**, the proposed action, proposed infrastructure needs (target vocabulary, see [target-ontology.md](./target-ontology.md#infrastructure-needs)), and proposed typed relationships. "retain" means the record stays a pattern; its edges may still change.

This is a proposal for review, not an applied change. Rows marked *(defer)* sit in the Desk, which is slated for a refactor.

## Summary

| Proposed kind | Records |
|---|---:|
| pattern | 163 |
| docs | 2 |
| showcase | 3 |
| implementation | 23 |
| principle | 4 |
| workflow | 4 |

| Headline action | Records |
|---|---:|
| retain | 156 |
| reclassify | 15 |
| merge | 8 |
| fold | 18 |
| split | 2 |

"implementation", "docs" and "showcase" rows stop being patterns: their refs move onto the pattern they implement, document or demonstrate, so no knowledge is lost. Merges and folds reduce the record count from 199 to about 165; the exact number depends on decisions D-03 and D-04 in the [decision register](./decision-register.md).

## Architecture & Request Pipeline (`architecture`, group `foundations`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `multi-client-core` | deep/proven | — | pattern | retain; declare as platform baseline (assumes) instead of 8 ad-hoc depends_on edges — Architectural style most server patterns assume; only 8 of them declare it. |  |  |
| `architecture-runtime-layers` | light/proven | — | docs | reclassify: documentation view → docs ref of multi-client-core — Describes v10r, not a reusable solution; "7-layer" is a volatile count in the title. |  |  |
| `architecture-codebase-map` | light/implemented | — | docs | reclassify: documentation view → docs ref of multi-client-core / docs-nav-hubs — A where-does-X-live table; nothing to emulate. |  |  |
| `architecture-middleware` | light/proven | — | pattern | retain; rename title (drop "14-stage": hooks.server.ts runs 18 handles) — Title count is stale. |  |  |
| `architecture-rest-api` | light/proven | — | pattern | retain; requires → architecture-error-handling? (review) |  |  |
| `architecture-error-handling` | light/proven | — | pattern | retain |  |  |
| `architecture-state-management` | light/proven | — | pattern | retain; target of specializes from url-search-state |  |  |
| `architecture-request-cycle-visualizer` | light/proven | — | showcase | reclassify: showcase, not a pattern → evidence of multi-client-core / architecture-middleware |  |  |
| `architecture-deployment` | light/implemented | — | pattern | retain; title carries planned state ("container target planned") → move to summary |  |  |
| `architecture-testing-infra` | light/proven | — | pattern | retain | relational-db (PGlite stand-in) |  |
| `architecture-pattern-mcp` | light/proven | — | pattern | retain; composes pattern registry + search; requires nothing at runtime — The registry itself (the meta-pattern) is not a record; consider folding "pattern registry" into this record. |  |  |
| `architecture-hosted-mcp` | light/proven | — | pattern | retain; fix requires + title ("four trust surfaces" — /api/mcp/3d is a fifth) | relational-db, key-value-store | composes anti-abuse-rate-limiting; composes architecture-pattern-mcp |
| `architecture-mcp-evolution` | deep/proven | — | pattern | retain; drop depends_on multi-client-core (baseline) |  | requires architecture-hosted-mcp |
| `architecture-mcp-authorization` | deep/implemented | — | pattern | retain; retype edges | relational-db, key-value-store, email-delivery (via auth) | requires identity-passwordless-auth (replaceable: any user-account auth); composes anti-abuse-rate-limiting; requires architecture-hosted-mcp |
| `architecture-agentic-architecture` | deep/implemented | — | pattern | retain as composite; retype all edges to composes — Umbrella whose optional "doors" are not linked today. |  | composes ai-agent-actions, ai-untrusted-content-boundary, architecture-mcp-evolution; composes (optional) ai-mcp-client, ai-agent-to-agent, ai-webmcp, ai-agent-user-interaction, ai-generative-ui, ai-agent-observability |
| `architecture-wasm-kernel` | light/proven | — | pattern | retain; add requires | wasm-toolchain, container-host (build only) |  |
| `architecture-external-service` | deep/proven | container-host | pattern | retain; retype edges | container-host | composes deadline-propagation, resilience-policy; composes (optional) latency-tracing |
| `architecture-engineering` | deep/implemented | — | pattern | retain; replace 4 depends_on with references (decision catalogue already links patterns); delivered-through architecture-pattern-mcp is not a prerequisite |  | none authored; derive "referenced by decision" from decisions.json |
| `url-search-state` | deep/proven | — | pattern | retain; retype |  | specializes architecture-state-management |

## App Shell & Navigation (`app-shell`, group `foundations`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `app-shell-layout` | light/proven | — | pattern | retain as composite of the app-shell constituents |  | composes app-shell-sidebar, app-shell-page-header, app-shell-navigation |
| `app-shell-sidebar` | light/proven | — | pattern | retain (constituent) |  |  |
| `app-shell-navigation` | light/proven | — | pattern | retain (constituent) |  |  |
| `app-shell-keyboard-shortcuts` | light/proven | — | pattern | retain |  | composes app-shell-modals |
| `app-shell-modals` | light/proven | — | pattern | retain |  |  |
| `app-shell-toasts` | light/proven | — | pattern | retain |  |  |
| `app-shell-session-lifecycle` | light/proven | — | pattern | retain |  | requires identity-passwordless-auth (any session auth) |
| `app-shell-settings` | light/proven | — | implementation | reclassify: feature page of v10r → implementation ref of app-shell-style-randomizer / i18n — A settings page, not a recurring solution. |  |  |
| `app-shell-style-randomizer` | light/proven | — | pattern | merge with admin-privacy-style-picking (same code src/lib/server/style, same showcase /showcases/shell/style) |  |  |
| `app-shell-loading-states` | light/proven | — | pattern | retain |  |  |
| `app-shell-empty-states` | light/proven | — | pattern | retain |  |  |
| `app-shell-page-header` | light/proven | — | pattern | retain (constituent of app-shell-layout) |  |  |
| `app-shell-quick-search` | light/proven | — | pattern | retain | relational-db (FTS lane) |  |

## UI Components & Design System (`ui`, group `foundations`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `ui-component-system` | deep/proven | — | pattern | retain as composite; becomes the home of the component inventory |  | composes ui-primitives(→fold), ui-design-tokens, ui-tonal-elevation, ui-fluid-styling |
| `ui-design-philosophy` | light/proven | — | principle | reclassify: principle; merge three-tier theming part into ui-design-tokens |  |  |
| `ui-explosive-discovery` | deep/proven | — | principle | reclassify: principle ("a review heuristic, not a rule" — its own summary) |  |  |
| `ui-latent-cards` | deep/proven | — | pattern | retain; retype |  | complements→drop ui-explosive-discovery (conforms to principle); ui-primitives = implementation detail, drop |
| `ui-design-tokens` | light/proven | — | pattern | retain (constituent of ui-component-system) |  |  |
| `ui-tonal-elevation` | light/proven | — | pattern | retain |  |  |
| `ui-primitives` | light/proven | — | implementation | fold into ui-component-system as implementation inventory ("~40" is a volatile count) |  |  |
| `ui-composites` | light/proven | — | implementation | fold into ui-component-system |  |  |
| `ui-layout-primitives` | light/proven | — | implementation | fold into ui-component-system |  |  |
| `ui-fluid-styling` | light/proven | — | pattern | retain |  |  |
| `ui-tables` | light/proven | — | implementation | fold into ui-component-system (component inventory) |  |  |
| `ui-menus` | light/proven | — | implementation | fold into ui-component-system |  |  |
| `ui-split-panes` | light/proven | — | implementation | fold into ui-component-system |  |  |
| `ui-typography` | light/proven | — | implementation | fold into ui-design-tokens |  |  |
| `ui-decorative` | light/proven | — | implementation | fold into app-shell-style-randomizer |  |  |

## Forms & Validation (`forms`, group `foundations`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `forms-superforms-valibot` | light/proven | — | pattern | retain as composite of the form variants |  |  |
| `forms-basic-forms` | light/proven | — | implementation | fold into forms-superforms-valibot (reference forms = evidence) |  |  |
| `forms-validation-timing` | light/proven | — | pattern | retain as constituent |  | specializes forms-superforms-valibot |
| `forms-multi-step-dynamic` | light/proven | — | pattern | retain |  | specializes forms-superforms-valibot |
| `forms-advanced-patterns` | light/proven | — | pattern | split or fold: three unrelated tactics (confirm, reset, edit) in one record |  | specializes forms-superforms-valibot |
| `forms-auth-forms` | light/proven | — | pattern | retain |  | alternative_to forms-superforms-valibot (for auth flows); requires identity-passwordless-auth |
| `forms-file-uploads` | light/proven | — | pattern | retain; add requires | object-storage | composes databases-object-storage |
| `dynamic-attributes` | deep/proven | — | pattern | retain | relational-db | composes versioned-document-session |
| `form-draft-recovery` | deep/proven | — | pattern | retain; retype |  | requires forms-superforms-valibot (extension of a host) |

## Internationalization (i18n) (`i18n`, group `foundations`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `i18n-locale-routing` | light/proven | — | pattern | retain |  |  |
| `i18n-messages` | light/proven | — | pattern | retain |  |  |
| `i18n-formatting` | light/proven | — | pattern | retain |  |  |
| `i18n-db-content` | light/implemented | — | pattern | retain; add requires | relational-db |  |

## Docs & Agent Experience (`docs-ax`, group `foundations`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `docs-nav-hubs` | deep/proven | — | pattern | retain |  |  |
| `pattern-index` | deep/proven | — | pattern | retain; retype |  | composes docs-nav-hubs; derived-from the registry (architecture-pattern-mcp) |
| `agent-experience` | deep/proven | — | pattern | retain |  | composes docs-nav-hubs, pattern-index |
| `resource-anchor-integrity` | light/proven | — | pattern | retain; move to integrity-truth (it is a source-of-truth gate) |  | specializes source-of-truth-gate |
| `ai-agent-skills` | deep/implemented | — | pattern | retain; rename id (ai- prefix, lives in docs-ax); retype |  | derived from registry, not from pattern-index → requires architecture-pattern-mcp registry concept |

## Databases & Storage (`databases`, group `data`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `databases-postgres-connection` | light/proven | — | pattern | retain; add requires (AE node kind relational-db already says postgres) | relational-db |  |
| `databases-schema-type-inference` | light/proven | — | pattern | retain; title "14 namespaces" is stale (16 pgSchema namespaces) | relational-db |  |
| `databases-queries-mutations-split` | light/proven | — | pattern | retain | relational-db |  |
| `databases-neo4j-connection` | light/proven | — | pattern | merge with graph-modeling and graph-traversal into one graph-database pattern | graph-db |  |
| `databases-graph-modeling` | light/proven | — | pattern | merge into graph database pattern | graph-db |  |
| `databases-graph-traversal` | light/proven | — | pattern | merge into graph database pattern | graph-db |  |
| `databases-polyglot-freshness` | light/implemented | — | pattern | retain | relational-db, graph-db |  |
| `databases-object-storage` | light/proven | — | pattern | retain; add requires | object-storage |  |
| `databases-cache` | light/proven | — | implementation | fold into hierarchical-cache as its Redis binding (technology, not a separate pattern) | key-value-store |  |
| `temporal-data-modeling` | light/proven | — | pattern | retain | relational-db |  |

## Database Operations (`db-ops`, group `data`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `db-ops-dev-prod-schema-workflow` | light/implemented | — | workflow | reclassify: workflow | relational-db |  |
| `db-ops-branch-refresh` | light/proven | — | workflow | reclassify: workflow | relational-db, third-party-api (Neon control plane) |  |
| `db-ops-bootstrap-seed` | light/implemented | — | workflow | reclassify: workflow | relational-db |  |

## Identity & Access (`identity`, group `identity-safety`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `identity-passwordless-auth` | light/proven | — | pattern | retain; add requires | relational-db, email-delivery |  |
| `identity-oauth` | light/proven | — | pattern | retain | relational-db, third-party-api | alternative_to identity-passwordless-auth (complementary sign-in method) |
| `identity-route-guards` | light/proven | — | pattern | retain |  | requires identity-capability-grants |
| `identity-capability-grants` | light/proven | — | pattern | retain; rename to avoid the "capability" homonym (e.g. access grants) | relational-db, scheduler |  |
| `identity-passkeys` | light/proven | — | pattern | retain | relational-db | requires identity-passwordless-auth |
| `identity-user-management` | light/proven | — | implementation | reclassify: feature routes → implementation ref of admin-privacy-gdpr / identity |  |  |

## Anti-Abuse (`anti-abuse`, group `identity-safety`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `anti-abuse-captcha` | light/proven | — | pattern | retain |  | alternative_to anti-abuse-honeypot |
| `anti-abuse-honeypot` | light/proven | — | pattern | retain |  |  |
| `anti-abuse-rate-limiting` | light/proven | — | pattern | retain; PROMOTE requires (Redis-backed, fail-closed) — currently []  | key-value-store |  |
| `anti-abuse-ai-budget` | light/proven | — | pattern | retain | key-value-store, llm-provider |  |
| `anti-abuse-bot-decision-audit` | light/proven | — | pattern | retain |  | composes(optional) anti-abuse-captcha, anti-abuse-honeypot, anti-abuse-rate-limiting |

## Admin & Privacy (`admin-privacy`, group `identity-safety`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `admin-privacy-admin-area` | light/proven | — | pattern | retain |  | requires identity-route-guards |
| `admin-privacy-gdpr` | light/proven | — | pattern | retain | relational-db |  |
| `admin-privacy-consent-cookies` | light/proven | — | pattern | retain |  |  |
| `admin-privacy-data-retention` | light/proven | — | pattern | retain | relational-db, scheduler | requires jobs-scheduler |
| `admin-privacy-pairing` | light/proven | — | pattern | retain | relational-db |  |
| `admin-privacy-style-picking` | light/proven | — | pattern | merge into app-shell-style-randomizer (one style resolution pattern; misfiled under admin-privacy) |  |  |
| `admin-privacy-audit-log` | light/proven | — | pattern | split: audit log (pattern) vs announcements (feature) | relational-db |  |
| `admin-privacy-feedback` | light/proven | — | implementation | reclassify: feature; its summary names a relation never encoded |  | composes anti-abuse-honeypot |
| `encryption-key-ring` | deep/proven | postgres, cron | pattern | retain; retype | relational-db, scheduler | composes(optional, rotation) jobs-scheduler |

## AI (`ai`, group `intelligence`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `ai-tool-harness` | deep/proven | ai-provider | pattern | retain | llm-provider |  |
| `ai-surfaces` | deep/proven | ai-provider | pattern | retain as composite; absorb ai-chat-assistant overlap | llm-provider | requires ai-tool-harness |
| `deskbot-approval-gate` | deep/proven | postgres, ai-provider | pattern | retain; rename away from Desk (Desk refactor pending) e.g. "AI action approval gate" | relational-db, llm-provider | requires ai-tool-harness; composes durable-step-execution |
| `layered-rag` | deep/proven | postgres, pgvector, ai-provider | pattern | retain as composite | relational-db, vector-search, llm-provider | composes(optional) ai-graph-rag; composes retrieval-endpoints |
| `retrieval-endpoints` | deep/proven | postgres, pgvector, ai-provider | pattern | retain as constituent |  | requires layered-rag |
| `ai-chat-assistant` | light/proven | — | implementation | merge into ai-surfaces (chatbot half); "AI SDK v6" is stale (v7) | llm-provider |  |
| `ai-chatbot-session` | light/proven | — | pattern | retain |  |  |
| `ai-provider-routing` | light/proven | — | pattern | retain; its circuit breaker duplicates resilience-policy | llm-provider, key-value-store | composes resilience-policy |
| `ai-site-awareness` | light/implemented | — | pattern | retain |  |  |
| `ai-graph-rag` | light/proven | — | pattern | retain as optional constituent of layered-rag; add requires | graph-db, vector-search, llm-provider |  |
| `ai-turn-trace` | light/proven | — | pattern | retain; retype | relational-db | requires ai-surfaces→ai-tool-harness |
| `ai-image-metadata` | light/proven | — | pattern | retain | llm-provider |  |
| `ai-cost-monitoring` | light/proven | — | pattern | retain | relational-db |  |
| `ai-toon-format` | light/implemented | — | pattern | retain |  |  |
| `ai-deskbot` | light/proven | — | implementation | merge into ai-surfaces / deskbot-approval-gate (Desk refactor pending) |  |  |
| `ai-harness-lens` | light/proven | — | principle | reclassify: principle ("a conceptual audit lens (not a module)") |  |  |
| `ai-untrusted-content-boundary` | deep/proven | ai-provider | pattern | retain | llm-provider | requires ai-tool-harness; composes deskbot-approval-gate |
| `ai-agent-actions` | deep/implemented | ai-provider | pattern | retain; drop desk-workspace edge (client executor target is an implementation detail) | llm-provider | requires ai-tool-harness, ai-surfaces; composes deskbot-approval-gate, ai-untrusted-content-boundary |
| `ai-mcp-client` | deep/implemented | third-party-api | pattern | retain | external-api | requires ai-tool-harness, ai-untrusted-content-boundary, deskbot-approval-gate |
| `ai-mcp-app-provider` | deep/implemented | — | pattern | retain; retype |  | requires an MCP server (architecture-hosted-mcp, replaceable) |
| `ai-agent-to-agent` | deep/implemented | — | pattern | retain; edge to architecture-engineering is a rationale link, not a prerequisite |  | none authored |
| `ai-generative-ui` | deep/implemented | ai-provider | pattern | retain | llm-provider | requires ui-component-system, ai-untrusted-content-boundary |
| `ai-webmcp` | light/implemented | — | pattern | retain |  | requires ai-agent-actions |
| `ai-agent-user-interaction` | light/implemented | — | pattern | retain |  | requires ai-agent-actions |
| `ai-agent-observability` | light/implemented | — | pattern | retain |  | requires ai-turn-trace |
| `ai-eval-regression-suite` | deep/proven | ai-provider, postgres | pattern | retain; ratchet edge is conceptual reuse, not a prerequisite | llm-provider, relational-db | requires ai-turn-trace |

## Toolkits (`toolkits`, group `intelligence`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `toolkits-image-kit` | light/proven | — | showcase | reclassify: showcase/toolkit composed of ai-image-metadata + frame cropper; remove toolkits category | llm-provider |  |

## Office Workflows (`office-workflows`, group `intelligence`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `pim-sheet-transform-recipe` | deep/proven | ai-provider | workflow | retain; kind workflow; link /workflows catalog entry to this id | llm-provider |  |

## Analytics (`analytics`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `analytics-pageview-hook` | light/proven | — | pattern | retain; title "last of 14 middleware stages" is stale (18) | relational-db |  |
| `analytics-consent-sessions` | light/proven | — | pattern | retain |  | requires admin-privacy-consent-cookies |
| `analytics-journeys` | light/proven | — | pattern | retain | relational-db |  |
| `analytics-funnels` | light/proven | — | pattern | retain | relational-db |  |
| `analytics-live-feed` | light/proven | — | showcase | reclassify: showcase demo (synthetic events) → evidence of notifications-sse-stream |  |  |
| `analytics-rollup-cleanup` | light/proven | — | pattern | retain | relational-db, scheduler | requires jobs-scheduler |
| `analytics-my-data-transparency` | light/proven | — | pattern | merge into admin-privacy-gdpr (same collectUserData report) |  |  |

## Notifications (`notifications`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `notifications-router-outbox` | light/proven | — | pattern | retain as composite | relational-db | composes notifications-channels, notifications-settings-matrix, notifications-schema-delivery-log |
| `notifications-channels` | light/proven | — | pattern | retain | email-delivery, external-api |  |
| `notifications-sse-stream` | light/proven | — | pattern | retain; conditional requirement | key-value-store (when serverless) |  |
| `notifications-settings-matrix` | light/proven | — | pattern | retain (constituent) |  |  |
| `notifications-schema-delivery-log` | light/proven | — | implementation | fold into notifications-router-outbox (schema of the composite) |  |  |

## Jobs & Scheduling (`jobs`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `jobs-scheduler` | deep/proven | postgres | pattern | retain; drop multi-client-core edge (baseline) | relational-db, scheduler |  |
| `jobs-platform-scheduling` | light/proven | — | pattern | fold into jobs-scheduler (platform-owned cadence is its own invariant) |  |  |
| `jobs-registered-catalog` | light/proven | — | implementation | reclassify: instance list of jobs → implementation refs of jobs-scheduler |  |  |

## PWA (`pwa`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `pwa-manifest` | light/proven | — | pattern | retain |  |  |
| `pwa-service-worker` | light/proven | — | pattern | retain; add requires (vocabulary has service-worker, unused) | service-worker |  |
| `pwa-update-flow` | light/proven | — | pattern | retain | service-worker | requires pwa-service-worker |
| `pwa-web-push` | light/implemented | — | pattern | retain | service-worker, relational-db | requires pwa-service-worker |

## Data Viz (`viz`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `viz-charts` | light/proven | — | implementation | fold into one data-visualization pattern (component inventory) |  |  |
| `viz-plots` | light/proven | — | implementation | fold into data-visualization |  |  |
| `viz-diagrams` | light/proven | — | implementation | fold into data-visualization |  |  |
| `viz-graphs` | light/proven | — | pattern | retain as the reusable tactic ("Svelte renders, D3 only computes positions") — or fold |  |  |
| `viz-maps` | light/proven | — | implementation | fold into data-visualization | external-api (tiles) |  |
| `viz-timelines` | light/implemented | — | implementation | fold into data-visualization |  |  |

## 3D (`3d`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `3d-threlte-integration` | light/proven | — | pattern | retain; most incoming edges are viewer implementation choices → retype |  |  |
| `3d-static-animated-scenes` | light/proven | — | implementation | fold into 3d-threlte-integration |  |  |
| `3d-model-viewer-customizer` | light/proven | — | pattern | retain |  | requires 3d-threlte-integration |
| `product-connection-engine` | deep/proven | — | pattern | retain; Threlte is the renderer of the showcase, the core is framework-free |  | composes(optional) 3d-threlte-integration |
| `asset-production-pipeline` | deep/proven | — | pattern | retain; retype edges | relational-db (via derivation) | composes derivation-key, provenance-record, anti-abuse-rate-limiting; composes(optional) architecture-hosted-mcp (MCP adapter), 3d-threlte-integration (viewer) |
| `agentic-parametric-modeling` | deep/implemented | web-worker | pattern | retain; retype edges; complete requires | relational-db, key-value-store, email-delivery (via auth); web-worker only for the native viewer | specializes asset-production-pipeline; composes architecture-mcp-authorization, anti-abuse-rate-limiting; requires architecture-hosted-mcp; composes(optional) ai-mcp-app-provider, 3d-threlte-integration |

## Content & Blog (`content`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `content-blog-engine` | light/proven | — | pattern | retain | relational-db | composes content-markdown-pipeline, content-comments(optional) |
| `content-comments` | light/proven | — | pattern | retain | relational-db | composes anti-abuse-rate-limiting |
| `content-markdown-pipeline` | light/proven | — | pattern | retain |  |  |
| `content-markdown-editor` | light/proven | — | pattern | retain |  | requires content-markdown-pipeline |
| `content-docs-site` | light/proven | — | pattern | retain; overlaps agent-experience / docs-nav-hubs (same docs site) |  |  |

## Desk Workspace (`desk`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `desk-workspace` | deep/proven | — | pattern | retain; Desk refactor pending — do not invest in desk edges now |  |  |
| `desk-spreadsheet-panel` | light/proven | — | pattern | retain (defer) |  | requires desk-workspace |
| `desk-mobile-chrome` | light/proven | — | pattern | retain (defer) |  |  |
| `desk-panel-menus` | light/proven | — | pattern | retain (defer) |  |  |
| `desk-ai-effects` | light/proven | — | pattern | retain (defer) |  |  |
| `desk-explorer` | light/proven | — | pattern | retain (defer) |  |  |

## External Integrations (`integrations`, group `features`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `name-check` | deep/proven | postgres, third-party-api | pattern | retain; retype |  | composes resilience-policy, deadline-propagation, hierarchical-cache |

## Interaction Velocity (`velocity-interaction`, group `velocity`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `optimistic-mutation` | deep/proven | — | pattern | retain |  |  |
| `intent-preloading` | deep/proven | — | pattern | retain |  |  |
| `virtualized-rendering` | deep/proven | — | pattern | retain; drop ui-component-system edge (conformance, baseline) |  |  |
| `velocity-idle-work` | light/implemented | — | pattern | retain or fold into intent-preloading (shared capability "idle work") |  |  |

## Data Velocity (`velocity-data`, group `velocity`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `hierarchical-cache` | deep/proven | redis | pattern | retain; absorbs databases-cache as its binding | key-value-store |  |
| `stale-while-revalidate` | deep/proven | — | pattern | retain |  | specializes hierarchical-cache; composes critical-path-deferred-tail |
| `singleflight` | deep/proven | — | pattern | retain |  | requires hierarchical-cache |
| `no-waterfall-loading` | deep/proven | — | pattern | retain |  |  |
| `velocity-screen-read-model` | light/implemented | — | pattern | retain | relational-db |  |
| `query-budget` | deep/proven | postgres | pattern | retain |  | composes performance-budget-ratchet |

## Runtime Velocity (`velocity-runtime`, group `velocity`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `critical-path-deferred-tail` | deep/proven | — | pattern | retain; drop baseline edge |  |  |
| `critical-rendering-path` | deep/implemented | — | pattern | retain |  |  |
| `heavy-dependency-quarantine` | deep/proven | — | pattern | retain |  | composes performance-budget-ratchet |
| `side-effect-free-components` | deep/proven | — | pattern | retain |  | composes performance-budget-ratchet |
| `main-thread-budget` | deep/proven | web-worker | pattern | retain | web-worker (optional rung: wasm-toolchain) |  |
| `resilience-policy` | deep/proven | — | pattern | retain | key-value-store (shared breaker state) — verify |  |
| `velocity-asset-delivery` | deep/proven | — | pattern | retain |  |  |
| `velocity-compute-locality` | light/proven | — | pattern | retain |  |  |
| `deadline-propagation` | deep/proven | — | pattern | retain; resilience-policy edge is complementary |  | none (or composes resilience-policy if retries consume the budget) |

## Velocity Measurement (`velocity-measurement`, group `velocity`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `latency-tracing` | deep/proven | — | pattern | retain |  |  |
| `performance-budget-ratchet` | deep/proven | — | pattern | retain |  |  |
| `scenario-harness` | deep/proven | — | pattern | retain |  | composes performance-budget-ratchet; verifies resilience-policy (evidence, not dependency) |

## Truth & Evidence (`integrity-truth`, group `integrity`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `source-of-truth-gate` | deep/proven | — | principle | retain; principle with an executable gate |  |  |
| `evidence-status-dimensions` | deep/proven | — | pattern | retain; adopt it for the registry's own evidence model |  |  |
| `asset-rights-manifest` | deep/proven | — | pattern | retain |  | specializes source-of-truth-gate |

## Derivation & Provenance (`integrity-derivation`, group `integrity`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `derivation-key` | deep/proven | postgres | pattern | retain; requires relational-db only when outputs are stored there | relational-db (conditional) |  |
| `reproducible-artifact-build` | deep/proven | — | pattern | retain |  |  |
| `provenance-record` | deep/proven | postgres | pattern | retain | relational-db | composes derivation-key |

## Durable Execution (`integrity-execution`, group `integrity`)

| id | now | requires now | kind | action | needs (proposed) | relationships (proposed) |
|---|---|---|---|---|---|---|
| `durable-step-execution` | deep/proven | postgres | pattern | retain | relational-db |  |
| `versioned-document-session` | deep/proven | postgres | pattern | retain | relational-db |  |

