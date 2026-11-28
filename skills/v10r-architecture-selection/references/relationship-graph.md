# v10r pattern relationship graph

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

Every pattern in an adoption relationship, in a valid build order (foundations and constituents first, ties in registry order). *Builds on*: must be available (the target's own equivalent satisfies it). *Composes*: constituents, each required, conditional (adopt when its condition holds) or optional (an enhancement). *Specializes*: a narrower realization; the generalization's invariants hold and its foundations and constituents apply, but it is never built twice. *Needs* are the pattern's own infrastructure needs by level; adopting it also takes the required and conditional needs of its foundations and required constituents.

| # | Pattern | Agent skill | Builds on | Composes | Specializes | Needs |
|---|---|---|---|---|---|---|
| 1 | `state-management` (light) | `v10r-foundations` | — | — | — | v10r's implementation uses llm-provider |
| 2 | `responsive-sidebar` (light) | `v10r-foundations` | — | — | — | v10r's implementation uses service-worker |
| 3 | `navigation-structure` (light) | `v10r-foundations` | — | — | — | — |
| 4 | `modal-layer-stack` (light) | `v10r-foundations` | — | — | — | — |
| 5 | `keyboard-shortcuts` (light) | `v10r-foundations` | `modal-layer-stack` | — | — | — |
| 6 | `page-header` (light) | `v10r-foundations` | — | — | — | — |
| 7 | `app-shell-layout` (light) | `v10r-foundations` | — | `responsive-sidebar`, `page-header`, `navigation-structure` (optional) | — | — |
| 8 | `component-system` (deep) | `v10r-foundations` | — | — | — | — |
| 9 | `schema-validated-forms` (light) | `v10r-foundations` | — | — | — | — |
| 10 | `validation-timing` (light) | `v10r-foundations` | `schema-validated-forms` | — | — | — |
| 11 | `multi-step-forms` (light) | `v10r-foundations` | `schema-validated-forms` | — | — | — |
| 12 | `resource-anchor-integrity` (light) | `v10r-integrity` | — | — | `source-of-truth-gate` | — |
| 13 | `object-storage-adapter` (light) | `v10r-data` | — | — | — | required object-storage · v10r's implementation uses relational-db |
| 14 | `file-uploads` (light) | `v10r-foundations` | `object-storage-adapter` | — | — | required object-storage · v10r's implementation uses relational-db |
| 15 | `passwordless-auth` (light) | `v10r-identity-safety` | — | — | — | required relational-db, email-delivery |
| 16 | `session-lifecycle-ui` (light) | `v10r-foundations` | `passwordless-auth` | — | — | — |
| 17 | `auth-forms` (light) | `v10r-foundations` | `passwordless-auth` | — | — | — |
| 18 | `route-guards` (light) | `v10r-identity-safety` | — | — | — | — |
| 19 | `passkeys` (light) | `v10r-identity-safety` | `passwordless-auth` | — | — | required relational-db · conditional key-value-store · v10r's implementation uses email-delivery |
| 20 | `rate-limiting` (light) | `v10r-identity-safety` | — | — | — | required key-value-store |
| 21 | `hosted-mcp` (light) | `v10r-foundations` | `rate-limiting` | — | — | v10r's implementation uses relational-db |
| 22 | `mcp-protocol-evolution` (deep) | `v10r-foundations` | `hosted-mcp` | — | — | — |
| 23 | `mcp-authorization` (deep) | `v10r-foundations` | `hosted-mcp`, `passwordless-auth`, `rate-limiting` | — | — | required relational-db · v10r's implementation uses email-delivery |
| 24 | `admin-area` (light) | `v10r-identity-safety` | `route-guards` | — | — | required relational-db |
| 25 | `consent-cookies` (light) | `v10r-identity-safety` | — | — | — | — |
| 26 | `ai-tool-harness` (deep) | `v10r-intelligence` | — | — | — | required llm-provider |
| 27 | `ai-surfaces` (deep) | `v10r-intelligence` | `ai-tool-harness` | — | — | required llm-provider · conditional relational-db |
| 28 | `graph-rag` (light) | `v10r-intelligence` | — | — | — | required graph-db, vector-search, relational-db, llm-provider |
| 29 | `layered-rag` (deep) | `v10r-intelligence` | — | `graph-rag` (optional) | — | required relational-db, vector-search, llm-provider · conditional graph-db |
| 30 | `retrieval-endpoints` (deep) | `v10r-intelligence` | `layered-rag` | — | — | required relational-db, vector-search, llm-provider |
| 31 | `turn-trace` (light) | `v10r-intelligence` | `ai-surfaces` | — | — | required relational-db |
| 32 | `ai-deskbot` (light) | `v10r-intelligence` | — | — | — | required llm-provider, relational-db |
| 33 | `consent-gated-sessions` (light) | `v10r-features` | `consent-cookies` | — | — | — |
| 34 | `notification-channels` (light) | `v10r-features` | — | — | — | required relational-db · conditional email-delivery, external-api |
| 35 | `notification-stream` (light) | `v10r-features` | — | — | — | required relational-db · conditional key-value-store |
| 36 | `notification-settings-matrix` (light) | `v10r-features` | — | — | — | required relational-db |
| 37 | `notification-outbox` (light) | `v10r-features` | — | `notification-channels`, `notification-settings-matrix`, `notification-stream` (optional) | — | required relational-db · conditional scheduler |
| 38 | `job-scheduling` (deep) | `v10r-features` | — | — | — | required relational-db, scheduler · v10r's implementation uses object-storage |
| 39 | `data-retention` (light) | `v10r-identity-safety` | `job-scheduling` | — | — | required relational-db, scheduler · conditional object-storage |
| 40 | `analytics-rollups` (light) | `v10r-features` | `job-scheduling` | — | — | required relational-db, scheduler |
| 41 | `service-worker-caching` (light) | `v10r-features` | — | — | — | required service-worker |
| 42 | `pwa-update-flow` (light) | `v10r-features` | `service-worker-caching` | — | — | required service-worker |
| 43 | `web-push` (light) | `v10r-features` | `service-worker-caching` | — | — | required service-worker, relational-db · v10r's implementation uses email-delivery |
| 44 | `threlte-integration` (light) | `v10r-features` | — | — | — | — |
| 45 | `model-viewer-customizer` (light) | `v10r-features` | `threlte-integration` | — | — | — |
| 46 | `product-connection-engine` (deep) | `v10r-features` | — | `threlte-integration` (optional) | — | — |
| 47 | `comments` (light) | `v10r-features` | `rate-limiting` | — | — | required relational-db |
| 48 | `markdown-pipeline` (light) | `v10r-features` | — | — | — | v10r's implementation uses object-storage, relational-db |
| 49 | `blog-engine` (light) | `v10r-features` | — | `markdown-pipeline`, `comments` (optional) | — | required relational-db · conditional object-storage |
| 50 | `markdown-editor` (light) | `v10r-features` | `markdown-pipeline` | — | — | — |
| 51 | `desk-workspace` (deep) | `v10r-features` | — | — | — | required relational-db |
| 52 | `desk-spreadsheet-panel` (light) | `v10r-features` | `desk-workspace` | — | — | — |
| 53 | `desk-mobile-chrome` (light) | `v10r-features` | `desk-workspace` | — | — | — |
| 54 | `desk-panel-menus` (light) | `v10r-features` | `desk-workspace` | — | — | — |
| 55 | `desk-ai-effects` (light) | `v10r-features` | `desk-workspace`, `ai-deskbot` | — | — | — |
| 56 | `desk-explorer` (light) | `v10r-features` | `desk-workspace` | — | — | — |
| 57 | `hierarchical-cache` (deep) | `v10r-velocity` | — | — | — | conditional key-value-store |
| 58 | `singleflight` (deep) | `v10r-velocity` | `hierarchical-cache` | — | — | conditional key-value-store |
| 59 | `critical-path-deferred-tail` (deep) | `v10r-velocity` | — | — | — | v10r's implementation uses relational-db |
| 60 | `stale-while-revalidate` (deep) | `v10r-velocity` | `hierarchical-cache`, `critical-path-deferred-tail` | — | — | conditional key-value-store |
| 61 | `resilience-policy` (deep) | `v10r-velocity` | — | — | — | conditional key-value-store |
| 62 | `provider-routing` (light) | `v10r-intelligence` | `resilience-policy` | — | — | required llm-provider |
| 63 | `deadline-propagation` (deep) | `v10r-velocity` | — | — | — | v10r's implementation uses relational-db |
| 64 | `latency-tracing` (deep) | `v10r-velocity` | — | — | — | v10r's implementation uses relational-db |
| 65 | `external-service-runtime` (deep) | `v10r-foundations` | — | `deadline-propagation`, `resilience-policy`, `latency-tracing` (optional) | — | required container-host |
| 66 | `performance-budget-ratchet` (deep) | `v10r-velocity` | — | — | — | — |
| 67 | `query-budget` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — | — | required relational-db |
| 68 | `heavy-dependency-quarantine` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — | — | — |
| 69 | `side-effect-free-components` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — | — | — |
| 70 | `scenario-harness` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — | — | v10r's implementation uses key-value-store |
| 71 | `multi-source-aggregation` (deep) | `v10r-features` | `resilience-policy`, `deadline-propagation`, `hierarchical-cache` | — | — | required external-api · conditional key-value-store, relational-db |
| 72 | `name-check` (deep) | `v10r-features` | `multi-source-aggregation`, `rate-limiting` | — | — | required key-value-store |
| 73 | `source-of-truth-gate` (deep) | `v10r-integrity` | — | — | — | v10r's implementation uses relational-db, llm-provider |
| 74 | `derivation-key` (deep) | `v10r-integrity` | — | — | — | conditional relational-db · v10r's implementation uses llm-provider |
| 75 | `reproducible-artifact-build` (deep) | `v10r-integrity` | — | — | — | — |
| 76 | `pattern-index` (deep) | `v10r-foundations` | `reproducible-artifact-build` | — | — | — |
| 77 | `agent-experience` (deep) | `v10r-foundations` | — | `pattern-index` | — | — |
| 78 | `agent-skills` (deep) | `v10r-foundations` | `reproducible-artifact-build` | — | — | — |
| 79 | `provenance-record` (deep) | `v10r-integrity` | — | `derivation-key` | — | required relational-db · v10r's implementation uses vector-search |
| 80 | `asset-production-pipeline` (deep) | `v10r-features` | `rate-limiting` | `derivation-key`, `provenance-record`, `hosted-mcp` (conditional), `threlte-integration` (optional) | — | — |
| 81 | `durable-step-execution` (deep) | `v10r-integrity` | — | — | — | required relational-db |
| 82 | `deskbot-approval-gate` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces` | `durable-step-execution` | — | required relational-db, llm-provider |
| 83 | `versioned-document-session` (deep) | `v10r-integrity` | — | — | — | required relational-db |
| 84 | `dynamic-attributes` (deep) | `v10r-foundations` | — | `versioned-document-session` | — | v10r's implementation uses relational-db |
| 85 | `asset-rights-manifest` (deep) | `v10r-integrity` | — | — | `source-of-truth-gate` | — |
| 86 | `encryption-key-ring` (deep) | `v10r-identity-safety` | `job-scheduling` | — | — | required relational-db, scheduler |
| 87 | `url-search-state` (deep) | `v10r-foundations` | — | — | `state-management` | — |
| 88 | `form-draft-recovery` (deep) | `v10r-foundations` | `schema-validated-forms` | — | — | — |
| 89 | `untrusted-content-boundary` (deep) | `v10r-intelligence` | `ai-tool-harness`, `deskbot-approval-gate` | — | — | required llm-provider |
| 90 | `agent-actions` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `untrusted-content-boundary` | — | — | required llm-provider |
| 91 | `mcp-client` (deep) | `v10r-intelligence` | `ai-tool-harness`, `untrusted-content-boundary`, `deskbot-approval-gate` | — | — | required llm-provider, external-api, relational-db |
| 92 | `mcp-app-provider` (deep) | `v10r-intelligence` | `hosted-mcp` | — | — | — |
| 93 | `agentic-parametric-modeling` (deep) | `v10r-features` | `hosted-mcp` | `mcp-authorization`, `mcp-app-provider` (optional), `threlte-integration` (optional) | `asset-production-pipeline` | conditional web-worker |
| 94 | `agent-to-agent` (deep) | `v10r-intelligence` | `untrusted-content-boundary`, `deskbot-approval-gate` | — | — | required relational-db, external-api |
| 95 | `generative-ui` (deep) | `v10r-intelligence` | `component-system`, `untrusted-content-boundary` | — | — | required llm-provider · v10r's implementation uses relational-db |
| 96 | `webmcp` (light) | `v10r-intelligence` | `agent-actions` | — | — | — |
| 97 | `ag-ui-endpoint` (light) | `v10r-intelligence` | `agent-actions` | — | — | required llm-provider |
| 98 | `agent-observability` (light) | `v10r-intelligence` | `turn-trace` | — | — | — |
| 99 | `agentic-architecture` (deep) | `v10r-foundations` | — | `agent-actions`, `untrusted-content-boundary`, `turn-trace`, `mcp-protocol-evolution` (conditional), `mcp-client` (conditional), `agent-to-agent` (conditional), `ag-ui-endpoint` (conditional), `generative-ui` (conditional), `agent-skills` (conditional), `webmcp` (optional), `agent-observability` (optional), `mcp-app-provider` (optional) | — | — |
| 100 | `ai-eval-regression-suite` (deep) | `v10r-intelligence` | `turn-trace` | — | — | required llm-provider |

## Infrastructure → patterns

- **relational-db** (Relational database; v10r: PostgreSQL (Neon) through Drizzle): `mcp-authorization`, `agentic-architecture`, `session-lifecycle-ui`, `auth-forms`, `translated-database-content`, `postgres-connection`, `schema-type-inference`, `queries-mutations-split`, `polyglot-freshness`, `temporal-data-modeling`, `dev-to-prod-schema-workflow`, `database-branch-refresh`, `database-bootstrap-seed`, `passwordless-auth`, `oauth-sign-in`, `grant-requests`, `passkeys`, `admin-area`, `gdpr-data-rights`, `data-retention`, `debug-pairing`, `audit-log`, `ai-surfaces` (conditional), `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `graph-rag`, `turn-trace`, `image-metadata-reader`, `ai-deskbot`, `pageview-collector`, `user-journeys`, `funnels`, `analytics-rollups`, `notification-outbox`, `notification-channels`, `notification-stream`, `notification-settings-matrix`, `job-scheduling`, `web-push`, `asset-production-pipeline`, `agentic-parametric-modeling`, `blog-engine`, `comments`, `desk-workspace`, `desk-spreadsheet-panel`, `desk-mobile-chrome`, `desk-panel-menus`, `desk-ai-effects`, `desk-explorer`, `screen-read-model`, `query-budget`, `multi-source-aggregation` (conditional), `name-check` (conditional), `derivation-key` (conditional), `provenance-record`, `durable-step-execution`, `versioned-document-session`, `dynamic-attributes`, `encryption-key-ring`, `untrusted-content-boundary`, `agent-actions`, `mcp-client`, `agent-to-agent`, `generative-ui`, `webmcp`, `ag-ui-endpoint`, `agent-observability`, `ai-eval-regression-suite`
- **vector-search** (Vector search; v10r: pgvector inside PostgreSQL): `layered-rag`, `retrieval-endpoints`, `graph-rag`
- **graph-db** (Graph database; v10r: Neo4j Aura over the HTTP Query API): `neo4j-connection`, `graph-modeling`, `graph-traversal`, `polyglot-freshness`, `database-bootstrap-seed` (conditional), `gdpr-data-rights` (conditional), `layered-rag` (conditional), `retrieval-endpoints` (conditional), `graph-rag`
- **key-value-store** (Shared key-value store; v10r: Redis (Upstash, REST)): `hosted-mcp`, `mcp-protocol-evolution`, `mcp-authorization`, `agentic-architecture` (conditional), `external-service-runtime` (conditional), `oauth-sign-in` (conditional), `passkeys` (conditional), `proof-of-work-captcha` (conditional), `rate-limiting`, `ai-token-budget`, `provider-routing` (conditional), `notification-stream` (conditional), `asset-production-pipeline`, `agentic-parametric-modeling`, `comments`, `hierarchical-cache` (conditional), `stale-while-revalidate` (conditional), `singleflight` (conditional), `resilience-policy` (conditional), `multi-source-aggregation` (conditional), `name-check`, `mcp-app-provider`
- **object-storage** (Object storage; v10r: Cloudflare R2 over the S3 API): `file-uploads`, `object-storage-adapter`, `gdpr-data-rights` (conditional), `data-retention` (conditional), `image-metadata-reader`, `blog-engine` (conditional), `asset-delivery-pipeline` (conditional)
- **scheduler** (Scheduler; v10r: Vercel cron calling the jobs runner): `grant-requests` (conditional), `data-retention`, `analytics-rollups`, `notification-outbox` (conditional), `job-scheduling`, `encryption-key-ring`
- **llm-provider** (LLM provider; v10r: provider-agnostic AI SDK adapters): `agentic-architecture`, `database-bootstrap-seed` (conditional), `ai-token-budget`, `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `chatbot-session`, `provider-routing`, `chatbot-site-awareness`, `graph-rag`, `turn-trace`, `image-metadata-reader`, `ai-deskbot`, `desk-ai-effects`, `untrusted-content-boundary`, `agent-actions`, `mcp-client`, `agent-to-agent`, `generative-ui`, `webmcp`, `ag-ui-endpoint`, `agent-observability`, `ai-eval-regression-suite`, `pim-sheet-transform`
- **email-delivery** (Email delivery; v10r: Resend): `mcp-authorization`, `session-lifecycle-ui`, `auth-forms`, `passwordless-auth`, `passkeys`, `notification-outbox` (conditional), `notification-channels` (conditional), `agentic-parametric-modeling`
- **external-api** (External API; v10r: per pattern, named in when/why): `agentic-architecture` (conditional), `database-branch-refresh`, `oauth-sign-in`, `notification-outbox` (conditional), `notification-channels` (conditional), `multi-source-aggregation`, `name-check`, `mcp-client`, `agent-to-agent`
- **web-worker** (Web worker; v10r: browser dedicated workers): `agentic-parametric-modeling` (conditional), `main-thread-budget`
- **service-worker** (Service worker; v10r: SvelteKit service worker): `service-worker-caching`, `pwa-update-flow`, `web-push`
- **wasm-toolchain** (WebAssembly toolchain; v10r: Rust compiled with wasm-pack): `wasm-compute-kernel`
- **container-host** (Container host; v10r: Podman locally, a container host remotely): `wasm-compute-kernel` (conditional), `external-service-runtime`
