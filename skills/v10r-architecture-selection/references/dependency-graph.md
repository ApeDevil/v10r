# v10r pattern dependency graph

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

Every pattern that depends on another or is depended on, in a valid build order (prerequisites first, ties in registry order). *Needs* are the pattern's own infrastructure needs by level; adopting it also takes the required and conditional needs of everything it depends on.

| # | Pattern | Agent skill | Depends on | Needs |
|---|---|---|---|---|
| 1 | `multi-client-core` (deep) | `v10r-foundations` | — | — |
| 2 | `architecture-state-management` (light) | `v10r-foundations` | — | v10r's implementation uses llm-provider |
| 3 | `architecture-pattern-mcp` (light) | `v10r-foundations` | — | — |
| 4 | `architecture-hosted-mcp` (light) | `v10r-foundations` | — | required key-value-store · v10r's implementation uses relational-db |
| 5 | `architecture-mcp-evolution` (deep) | `v10r-foundations` | `multi-client-core` | — |
| 6 | `architecture-wasm-kernel` (light) | `v10r-foundations` | — | required wasm-toolchain · conditional container-host |
| 7 | `ui-component-system` (deep) | `v10r-foundations` | — | — |
| 8 | `ui-explosive-discovery` (deep) | `v10r-foundations` | — | — |
| 9 | `ui-primitives` (light) | `v10r-foundations` | — | — |
| 10 | `ui-latent-cards` (deep) | `v10r-foundations` | `ui-explosive-discovery`, `ui-primitives` | — |
| 11 | `forms-superforms-valibot` (light) | `v10r-foundations` | — | — |
| 12 | `docs-nav-hubs` (deep) | `v10r-foundations` | — | — |
| 13 | `pattern-index` (deep) | `v10r-foundations` | `docs-nav-hubs` | — |
| 14 | `agent-experience` (deep) | `v10r-foundations` | `docs-nav-hubs` | — |
| 15 | `ai-agent-skills` (deep) | `v10r-foundations` | `pattern-index` | — |
| 16 | `identity-passwordless-auth` (light) | `v10r-identity-safety` | — | required relational-db, email-delivery |
| 17 | `anti-abuse-rate-limiting` (light) | `v10r-identity-safety` | — | required key-value-store |
| 18 | `architecture-mcp-authorization` (deep) | `v10r-foundations` | `architecture-hosted-mcp`, `identity-passwordless-auth`, `anti-abuse-rate-limiting` | required relational-db · v10r's implementation uses email-delivery |
| 19 | `ai-tool-harness` (deep) | `v10r-intelligence` | `multi-client-core` | required llm-provider |
| 20 | `ai-surfaces` (deep) | `v10r-intelligence` | `ai-tool-harness` | required llm-provider · conditional relational-db |
| 21 | `layered-rag` (deep) | `v10r-intelligence` | `multi-client-core` | required relational-db, vector-search, llm-provider · conditional graph-db |
| 22 | `retrieval-endpoints` (deep) | `v10r-intelligence` | `layered-rag` | required relational-db, vector-search, llm-provider |
| 23 | `ai-turn-trace` (light) | `v10r-intelligence` | `ai-surfaces` | required relational-db |
| 24 | `ai-deskbot` (light) | `v10r-intelligence` | — | required llm-provider, relational-db |
| 25 | `jobs-scheduler` (deep) | `v10r-features` | `multi-client-core` | required relational-db, scheduler |
| 26 | `3d-threlte-integration` (light) | `v10r-features` | — | — |
| 27 | `product-connection-engine` (deep) | `v10r-features` | `3d-threlte-integration` | — |
| 28 | `desk-workspace` (deep) | `v10r-features` | `multi-client-core` | required relational-db |
| 29 | `desk-spreadsheet-panel` (light) | `v10r-features` | `desk-workspace` | — |
| 30 | `desk-mobile-chrome` (light) | `v10r-features` | `desk-workspace` | — |
| 31 | `desk-panel-menus` (light) | `v10r-features` | `desk-workspace` | — |
| 32 | `desk-ai-effects` (light) | `v10r-features` | `desk-workspace`, `ai-deskbot` | — |
| 33 | `desk-explorer` (light) | `v10r-features` | `desk-workspace` | — |
| 34 | `intent-preloading` (deep) | `v10r-velocity` | — | — |
| 35 | `virtualized-rendering` (deep) | `v10r-velocity` | `ui-component-system` | — |
| 36 | `velocity-idle-work` (light) | `v10r-velocity` | `intent-preloading` | — |
| 37 | `hierarchical-cache` (deep) | `v10r-velocity` | — | conditional key-value-store |
| 38 | `singleflight` (deep) | `v10r-velocity` | `hierarchical-cache` | conditional key-value-store |
| 39 | `critical-path-deferred-tail` (deep) | `v10r-velocity` | `multi-client-core` | v10r's implementation uses relational-db |
| 40 | `stale-while-revalidate` (deep) | `v10r-velocity` | `hierarchical-cache`, `critical-path-deferred-tail` | conditional key-value-store |
| 41 | `resilience-policy` (deep) | `v10r-velocity` | — | conditional key-value-store |
| 42 | `deadline-propagation` (deep) | `v10r-velocity` | `resilience-policy` | v10r's implementation uses relational-db |
| 43 | `latency-tracing` (deep) | `v10r-velocity` | — | v10r's implementation uses relational-db |
| 44 | `architecture-external-service` (deep) | `v10r-foundations` | `multi-client-core`, `deadline-propagation`, `resilience-policy`, `latency-tracing` | required container-host |
| 45 | `architecture-engineering` (deep) | `v10r-foundations` | `multi-client-core`, `architecture-wasm-kernel`, `architecture-external-service`, `architecture-pattern-mcp` | — |
| 46 | `performance-budget-ratchet` (deep) | `v10r-velocity` | — | — |
| 47 | `query-budget` (deep) | `v10r-velocity` | `performance-budget-ratchet` | required relational-db |
| 48 | `heavy-dependency-quarantine` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — |
| 49 | `side-effect-free-components` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — |
| 50 | `scenario-harness` (deep) | `v10r-velocity` | `performance-budget-ratchet`, `resilience-policy` | v10r's implementation uses key-value-store |
| 51 | `name-check` (deep) | `v10r-features` | `resilience-policy`, `deadline-propagation`, `hierarchical-cache` | required external-api · conditional key-value-store, relational-db |
| 52 | `source-of-truth-gate` (deep) | `v10r-integrity` | — | v10r's implementation uses relational-db, llm-provider |
| 53 | `derivation-key` (deep) | `v10r-integrity` | — | conditional relational-db · v10r's implementation uses llm-provider |
| 54 | `provenance-record` (deep) | `v10r-integrity` | `derivation-key` | required relational-db · v10r's implementation uses vector-search |
| 55 | `asset-production-pipeline` (deep) | `v10r-features` | `3d-threlte-integration`, `derivation-key`, `provenance-record`, `anti-abuse-rate-limiting`, `architecture-hosted-mcp` | — |
| 56 | `durable-step-execution` (deep) | `v10r-integrity` | — | required relational-db |
| 57 | `deskbot-approval-gate` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces`, `durable-step-execution` | required relational-db, llm-provider |
| 58 | `versioned-document-session` (deep) | `v10r-integrity` | — | required relational-db |
| 59 | `dynamic-attributes` (deep) | `v10r-foundations` | `versioned-document-session` | v10r's implementation uses relational-db |
| 60 | `asset-rights-manifest` (deep) | `v10r-integrity` | `source-of-truth-gate` | — |
| 61 | `encryption-key-ring` (deep) | `v10r-identity-safety` | `jobs-scheduler` | required relational-db, scheduler |
| 62 | `url-search-state` (deep) | `v10r-foundations` | `architecture-state-management` | — |
| 63 | `form-draft-recovery` (deep) | `v10r-foundations` | `forms-superforms-valibot` | — |
| 64 | `ai-untrusted-content-boundary` (deep) | `v10r-intelligence` | `ai-tool-harness`, `deskbot-approval-gate` | required llm-provider |
| 65 | `ai-agent-actions` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `ai-untrusted-content-boundary` | required llm-provider |
| 66 | `architecture-agentic-architecture` (deep) | `v10r-foundations` | `ai-agent-actions`, `ai-untrusted-content-boundary`, `architecture-mcp-evolution` | — |
| 67 | `ai-mcp-client` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-untrusted-content-boundary`, `deskbot-approval-gate` | required llm-provider, external-api, relational-db |
| 68 | `ai-mcp-app-provider` (deep) | `v10r-intelligence` | `architecture-hosted-mcp` | — |
| 69 | `agentic-parametric-modeling` (deep) | `v10r-features` | `asset-production-pipeline`, `architecture-mcp-authorization`, `architecture-hosted-mcp`, `ai-mcp-app-provider`, `anti-abuse-rate-limiting`, `3d-threlte-integration` | conditional web-worker |
| 70 | `ai-agent-to-agent` (deep) | `v10r-intelligence` | `architecture-engineering` | required relational-db, external-api |
| 71 | `ai-generative-ui` (deep) | `v10r-intelligence` | `ui-component-system`, `ai-untrusted-content-boundary` | required llm-provider · v10r's implementation uses relational-db |
| 72 | `ai-webmcp` (light) | `v10r-intelligence` | `ai-agent-actions` | — |
| 73 | `ai-agent-user-interaction` (light) | `v10r-intelligence` | `ai-agent-actions` | required llm-provider |
| 74 | `ai-agent-observability` (light) | `v10r-intelligence` | `ai-turn-trace` | — |
| 75 | `ai-eval-regression-suite` (deep) | `v10r-intelligence` | `ai-turn-trace`, `performance-budget-ratchet` | required llm-provider |

## Infrastructure → patterns

- **relational-db** (Relational database; v10r: PostgreSQL (Neon) through Drizzle): `architecture-mcp-authorization`, `architecture-agentic-architecture`, `i18n-db-content`, `databases-postgres-connection`, `databases-schema-type-inference`, `databases-queries-mutations-split`, `databases-polyglot-freshness`, `temporal-data-modeling`, `db-ops-dev-prod-schema-workflow`, `db-ops-branch-refresh`, `db-ops-bootstrap-seed`, `identity-passwordless-auth`, `identity-oauth`, `identity-capability-grants`, `identity-passkeys`, `identity-user-management`, `admin-privacy-admin-area`, `admin-privacy-gdpr`, `admin-privacy-data-retention`, `admin-privacy-pairing`, `admin-privacy-audit-log`, `admin-privacy-feedback`, `ai-surfaces` (conditional), `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `ai-chat-assistant` (conditional), `ai-graph-rag`, `ai-turn-trace`, `ai-image-metadata`, `ai-deskbot`, `analytics-pageview-hook`, `analytics-journeys`, `analytics-funnels`, `analytics-live-feed`, `analytics-rollup-cleanup`, `analytics-my-data-transparency`, `notifications-router-outbox`, `notifications-channels`, `notifications-sse-stream`, `notifications-settings-matrix`, `notifications-schema-delivery-log`, `jobs-scheduler`, `pwa-web-push`, `asset-production-pipeline`, `agentic-parametric-modeling`, `content-blog-engine`, `content-comments`, `desk-workspace`, `desk-spreadsheet-panel`, `desk-mobile-chrome`, `desk-panel-menus`, `desk-ai-effects`, `desk-explorer`, `velocity-screen-read-model`, `query-budget`, `name-check` (conditional), `derivation-key` (conditional), `provenance-record`, `durable-step-execution`, `versioned-document-session`, `dynamic-attributes`, `encryption-key-ring`, `ai-untrusted-content-boundary`, `ai-agent-actions`, `ai-mcp-client`, `ai-agent-to-agent`, `ai-generative-ui`, `ai-webmcp`, `ai-agent-user-interaction`, `ai-agent-observability`, `ai-eval-regression-suite`
- **vector-search** (Vector search; v10r: pgvector inside PostgreSQL): `layered-rag`, `retrieval-endpoints`, `ai-graph-rag`
- **graph-db** (Graph database; v10r: Neo4j Aura over the HTTP Query API): `databases-neo4j-connection`, `databases-graph-modeling`, `databases-graph-traversal`, `databases-polyglot-freshness`, `db-ops-bootstrap-seed` (conditional), `admin-privacy-gdpr` (conditional), `layered-rag` (conditional), `retrieval-endpoints` (conditional), `ai-graph-rag`
- **key-value-store** (Shared key-value store; v10r: Redis (Upstash, REST)): `architecture-hosted-mcp`, `architecture-mcp-authorization`, `architecture-external-service` (conditional), `architecture-engineering` (conditional), `databases-cache`, `identity-oauth` (conditional), `identity-passkeys` (conditional), `anti-abuse-captcha` (conditional), `anti-abuse-rate-limiting`, `anti-abuse-ai-budget`, `analytics-live-feed` (conditional), `notifications-sse-stream` (conditional), `asset-production-pipeline`, `agentic-parametric-modeling`, `hierarchical-cache` (conditional), `stale-while-revalidate` (conditional), `singleflight` (conditional), `resilience-policy` (conditional), `deadline-propagation` (conditional), `scenario-harness` (conditional), `name-check` (conditional), `ai-mcp-app-provider`, `ai-agent-to-agent` (conditional)
- **object-storage** (Object storage; v10r: Cloudflare R2 over the S3 API): `forms-file-uploads`, `databases-object-storage`, `admin-privacy-gdpr` (conditional), `admin-privacy-data-retention` (conditional), `ai-image-metadata`, `toolkits-image-kit`, `content-blog-engine` (conditional), `velocity-asset-delivery` (conditional)
- **scheduler** (Scheduler; v10r: Vercel cron calling the jobs runner): `identity-capability-grants` (conditional), `admin-privacy-data-retention`, `analytics-rollup-cleanup`, `notifications-router-outbox` (conditional), `jobs-scheduler`, `jobs-platform-scheduling`, `jobs-registered-catalog`, `encryption-key-ring`
- **llm-provider** (LLM provider; v10r: provider-agnostic AI SDK adapters): `architecture-agentic-architecture`, `db-ops-bootstrap-seed` (conditional), `anti-abuse-ai-budget`, `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `ai-chat-assistant`, `ai-chatbot-session`, `ai-provider-routing`, `ai-site-awareness`, `ai-graph-rag`, `ai-turn-trace`, `ai-image-metadata`, `ai-deskbot`, `toolkits-image-kit`, `desk-ai-effects`, `ai-untrusted-content-boundary`, `ai-agent-actions`, `ai-mcp-client`, `ai-generative-ui`, `ai-webmcp`, `ai-agent-user-interaction`, `ai-agent-observability`, `ai-eval-regression-suite`, `pim-sheet-transform-recipe`
- **email-delivery** (Email delivery; v10r: Resend): `architecture-mcp-authorization`, `identity-passwordless-auth`, `notifications-channels` (conditional), `agentic-parametric-modeling`
- **external-api** (External API; v10r: per pattern, named in when/why): `db-ops-branch-refresh` (conditional), `identity-oauth`, `notifications-channels` (conditional), `viz-maps` (conditional), `name-check`, `ai-mcp-client`, `ai-agent-to-agent`
- **web-worker** (Web worker; v10r: browser dedicated workers): `agentic-parametric-modeling` (conditional), `main-thread-budget`
- **service-worker** (Service worker; v10r: SvelteKit service worker): `pwa-service-worker`, `pwa-update-flow`, `pwa-web-push`
- **wasm-toolchain** (WebAssembly toolchain; v10r: Rust compiled with wasm-pack): `architecture-wasm-kernel`, `architecture-engineering`, `ai-agent-to-agent`
- **container-host** (Container host; v10r: Podman locally, a container host remotely): `architecture-wasm-kernel` (conditional), `architecture-external-service`, `architecture-engineering`, `ai-agent-to-agent`
