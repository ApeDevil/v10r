# v10r pattern dependency graph

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

Every pattern that depends on another or is depended on, in a valid build order (prerequisites first, ties in registry order). *Needs* are the pattern's own infrastructure needs by level; adopting it also takes the required and conditional needs of everything it depends on.

| # | Pattern | Agent skill | Depends on | Needs |
|---|---|---|---|---|
| 1 | `multi-client-core` (deep) | `v10r-foundations` | — | v10r's implementation uses llm-provider, relational-db |
| 2 | `state-management` (light) | `v10r-foundations` | — | v10r's implementation uses llm-provider |
| 3 | `pattern-mcp` (light) | `v10r-foundations` | — | — |
| 4 | `mcp-protocol-evolution` (deep) | `v10r-foundations` | `multi-client-core` | — |
| 5 | `wasm-compute-kernel` (light) | `v10r-foundations` | — | required wasm-toolchain · conditional container-host |
| 6 | `component-system` (deep) | `v10r-foundations` | — | — |
| 7 | `explosive-discovery` (deep) | `v10r-foundations` | — | — |
| 8 | `latent-cards` (deep) | `v10r-foundations` | `explosive-discovery`, `component-system` | — |
| 9 | `schema-validated-forms` (light) | `v10r-foundations` | — | — |
| 10 | `docs-nav-hubs` (deep) | `v10r-foundations` | — | — |
| 11 | `pattern-index` (deep) | `v10r-foundations` | `docs-nav-hubs` | — |
| 12 | `agent-experience` (deep) | `v10r-foundations` | `docs-nav-hubs` | — |
| 13 | `agent-skills` (deep) | `v10r-foundations` | `pattern-index` | — |
| 14 | `passwordless-auth` (light) | `v10r-identity-safety` | — | required relational-db, email-delivery |
| 15 | `rate-limiting` (light) | `v10r-identity-safety` | — | required key-value-store |
| 16 | `hosted-mcp` (light) | `v10r-foundations` | `rate-limiting` | v10r's implementation uses relational-db |
| 17 | `mcp-authorization` (deep) | `v10r-foundations` | `hosted-mcp`, `passwordless-auth`, `rate-limiting` | required relational-db · v10r's implementation uses email-delivery |
| 18 | `ai-tool-harness` (deep) | `v10r-intelligence` | `multi-client-core` | required llm-provider |
| 19 | `ai-surfaces` (deep) | `v10r-intelligence` | `ai-tool-harness` | required llm-provider · conditional relational-db |
| 20 | `layered-rag` (deep) | `v10r-intelligence` | `multi-client-core` | required relational-db, vector-search, llm-provider · conditional graph-db |
| 21 | `retrieval-endpoints` (deep) | `v10r-intelligence` | `layered-rag` | required relational-db, vector-search, llm-provider |
| 22 | `turn-trace` (light) | `v10r-intelligence` | `ai-surfaces` | required relational-db |
| 23 | `ai-deskbot` (light) | `v10r-intelligence` | — | required llm-provider, relational-db |
| 24 | `job-scheduling` (deep) | `v10r-features` | `multi-client-core` | required relational-db, scheduler · v10r's implementation uses object-storage |
| 25 | `threlte-integration` (light) | `v10r-features` | — | — |
| 26 | `product-connection-engine` (deep) | `v10r-features` | `threlte-integration` | — |
| 27 | `desk-workspace` (deep) | `v10r-features` | `multi-client-core` | required relational-db |
| 28 | `desk-spreadsheet-panel` (light) | `v10r-features` | `desk-workspace` | — |
| 29 | `desk-mobile-chrome` (light) | `v10r-features` | `desk-workspace` | — |
| 30 | `desk-panel-menus` (light) | `v10r-features` | `desk-workspace` | — |
| 31 | `desk-ai-effects` (light) | `v10r-features` | `desk-workspace`, `ai-deskbot` | — |
| 32 | `desk-explorer` (light) | `v10r-features` | `desk-workspace` | — |
| 33 | `intent-preloading` (deep) | `v10r-velocity` | — | — |
| 34 | `virtualized-rendering` (deep) | `v10r-velocity` | `component-system` | — |
| 35 | `idle-work` (light) | `v10r-velocity` | `intent-preloading` | — |
| 36 | `hierarchical-cache` (deep) | `v10r-velocity` | — | conditional key-value-store |
| 37 | `singleflight` (deep) | `v10r-velocity` | `hierarchical-cache` | conditional key-value-store |
| 38 | `critical-path-deferred-tail` (deep) | `v10r-velocity` | `multi-client-core` | v10r's implementation uses relational-db |
| 39 | `stale-while-revalidate` (deep) | `v10r-velocity` | `hierarchical-cache`, `critical-path-deferred-tail` | conditional key-value-store |
| 40 | `resilience-policy` (deep) | `v10r-velocity` | — | conditional key-value-store |
| 41 | `deadline-propagation` (deep) | `v10r-velocity` | `resilience-policy` | v10r's implementation uses relational-db |
| 42 | `latency-tracing` (deep) | `v10r-velocity` | — | v10r's implementation uses relational-db |
| 43 | `external-service-runtime` (deep) | `v10r-foundations` | `multi-client-core`, `deadline-propagation`, `resilience-policy`, `latency-tracing` | required container-host |
| 44 | `architecture-engineering` (deep) | `v10r-foundations` | `multi-client-core`, `wasm-compute-kernel`, `external-service-runtime`, `pattern-mcp` | — |
| 45 | `performance-budget-ratchet` (deep) | `v10r-velocity` | — | — |
| 46 | `query-budget` (deep) | `v10r-velocity` | `performance-budget-ratchet` | required relational-db |
| 47 | `heavy-dependency-quarantine` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — |
| 48 | `side-effect-free-components` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — |
| 49 | `scenario-harness` (deep) | `v10r-velocity` | `performance-budget-ratchet`, `resilience-policy` | v10r's implementation uses key-value-store |
| 50 | `multi-source-aggregation` (deep) | `v10r-features` | `resilience-policy`, `deadline-propagation`, `hierarchical-cache` | required external-api · conditional key-value-store, relational-db |
| 51 | `name-check` (deep) | `v10r-features` | `multi-source-aggregation`, `rate-limiting` | required key-value-store |
| 52 | `source-of-truth-gate` (deep) | `v10r-integrity` | — | v10r's implementation uses relational-db, llm-provider |
| 53 | `derivation-key` (deep) | `v10r-integrity` | — | conditional relational-db · v10r's implementation uses llm-provider |
| 54 | `provenance-record` (deep) | `v10r-integrity` | `derivation-key` | required relational-db · v10r's implementation uses vector-search |
| 55 | `asset-production-pipeline` (deep) | `v10r-features` | `threlte-integration`, `derivation-key`, `provenance-record`, `rate-limiting`, `hosted-mcp` | — |
| 56 | `durable-step-execution` (deep) | `v10r-integrity` | — | required relational-db |
| 57 | `deskbot-approval-gate` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces`, `durable-step-execution` | required relational-db, llm-provider |
| 58 | `versioned-document-session` (deep) | `v10r-integrity` | — | required relational-db |
| 59 | `dynamic-attributes` (deep) | `v10r-foundations` | `versioned-document-session` | v10r's implementation uses relational-db |
| 60 | `asset-rights-manifest` (deep) | `v10r-integrity` | `source-of-truth-gate` | — |
| 61 | `encryption-key-ring` (deep) | `v10r-identity-safety` | `job-scheduling` | required relational-db, scheduler |
| 62 | `url-search-state` (deep) | `v10r-foundations` | `state-management` | — |
| 63 | `form-draft-recovery` (deep) | `v10r-foundations` | `schema-validated-forms` | — |
| 64 | `untrusted-content-boundary` (deep) | `v10r-intelligence` | `ai-tool-harness`, `deskbot-approval-gate` | required llm-provider |
| 65 | `agent-actions` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `untrusted-content-boundary` | required llm-provider |
| 66 | `agentic-architecture` (deep) | `v10r-foundations` | `agent-actions`, `untrusted-content-boundary`, `mcp-protocol-evolution` | — |
| 67 | `mcp-client` (deep) | `v10r-intelligence` | `ai-tool-harness`, `untrusted-content-boundary`, `deskbot-approval-gate` | required llm-provider, external-api, relational-db |
| 68 | `mcp-app-provider` (deep) | `v10r-intelligence` | `hosted-mcp` | — |
| 69 | `agentic-parametric-modeling` (deep) | `v10r-features` | `asset-production-pipeline`, `mcp-authorization`, `hosted-mcp`, `mcp-app-provider`, `rate-limiting`, `threlte-integration` | conditional web-worker |
| 70 | `agent-to-agent` (deep) | `v10r-intelligence` | `architecture-engineering` | required relational-db, external-api |
| 71 | `generative-ui` (deep) | `v10r-intelligence` | `component-system`, `untrusted-content-boundary` | required llm-provider · v10r's implementation uses relational-db |
| 72 | `webmcp` (light) | `v10r-intelligence` | `agent-actions` | — |
| 73 | `ag-ui-endpoint` (light) | `v10r-intelligence` | `agent-actions` | required llm-provider |
| 74 | `agent-observability` (light) | `v10r-intelligence` | `turn-trace` | — |
| 75 | `ai-eval-regression-suite` (deep) | `v10r-intelligence` | `turn-trace`, `performance-budget-ratchet` | required llm-provider |

## Infrastructure → patterns

- **relational-db** (Relational database; v10r: PostgreSQL (Neon) through Drizzle): `mcp-authorization`, `agentic-architecture`, `translated-database-content`, `postgres-connection`, `schema-type-inference`, `queries-mutations-split`, `polyglot-freshness`, `temporal-data-modeling`, `dev-to-prod-schema-workflow`, `database-branch-refresh`, `database-bootstrap-seed`, `passwordless-auth`, `oauth-sign-in`, `grant-requests`, `passkeys`, `admin-area`, `gdpr-data-rights`, `data-retention`, `debug-pairing`, `audit-log`, `ai-surfaces` (conditional), `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `graph-rag`, `turn-trace`, `image-metadata-reader`, `ai-deskbot`, `pageview-collector`, `user-journeys`, `funnels`, `analytics-rollups`, `notification-outbox`, `notification-channels`, `notification-stream`, `notification-settings-matrix`, `job-scheduling`, `web-push`, `asset-production-pipeline`, `agentic-parametric-modeling`, `blog-engine`, `comments`, `desk-workspace`, `desk-spreadsheet-panel`, `desk-mobile-chrome`, `desk-panel-menus`, `desk-ai-effects`, `desk-explorer`, `screen-read-model`, `query-budget`, `multi-source-aggregation` (conditional), `name-check` (conditional), `derivation-key` (conditional), `provenance-record`, `durable-step-execution`, `versioned-document-session`, `dynamic-attributes`, `encryption-key-ring`, `untrusted-content-boundary`, `agent-actions`, `mcp-client`, `agent-to-agent`, `generative-ui`, `webmcp`, `ag-ui-endpoint`, `agent-observability`, `ai-eval-regression-suite`
- **vector-search** (Vector search; v10r: pgvector inside PostgreSQL): `layered-rag`, `retrieval-endpoints`, `graph-rag`
- **graph-db** (Graph database; v10r: Neo4j Aura over the HTTP Query API): `neo4j-connection`, `graph-modeling`, `graph-traversal`, `polyglot-freshness`, `database-bootstrap-seed` (conditional), `gdpr-data-rights` (conditional), `layered-rag` (conditional), `retrieval-endpoints` (conditional), `graph-rag`
- **key-value-store** (Shared key-value store; v10r: Redis (Upstash, REST)): `hosted-mcp`, `mcp-authorization`, `external-service-runtime` (conditional), `architecture-engineering` (conditional), `oauth-sign-in` (conditional), `passkeys` (conditional), `proof-of-work-captcha` (conditional), `rate-limiting`, `ai-token-budget`, `notification-stream` (conditional), `asset-production-pipeline`, `agentic-parametric-modeling`, `hierarchical-cache` (conditional), `stale-while-revalidate` (conditional), `singleflight` (conditional), `resilience-policy` (conditional), `deadline-propagation` (conditional), `scenario-harness` (conditional), `multi-source-aggregation` (conditional), `name-check`, `mcp-app-provider`, `agent-to-agent` (conditional)
- **object-storage** (Object storage; v10r: Cloudflare R2 over the S3 API): `file-uploads`, `object-storage-adapter`, `gdpr-data-rights` (conditional), `data-retention` (conditional), `image-metadata-reader`, `blog-engine` (conditional), `asset-delivery-pipeline` (conditional)
- **scheduler** (Scheduler; v10r: Vercel cron calling the jobs runner): `grant-requests` (conditional), `data-retention`, `analytics-rollups`, `notification-outbox` (conditional), `job-scheduling`, `encryption-key-ring`
- **llm-provider** (LLM provider; v10r: provider-agnostic AI SDK adapters): `agentic-architecture`, `database-bootstrap-seed` (conditional), `ai-token-budget`, `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `chatbot-session`, `provider-routing`, `chatbot-site-awareness`, `graph-rag`, `turn-trace`, `image-metadata-reader`, `ai-deskbot`, `desk-ai-effects`, `untrusted-content-boundary`, `agent-actions`, `mcp-client`, `generative-ui`, `webmcp`, `ag-ui-endpoint`, `agent-observability`, `ai-eval-regression-suite`, `pim-sheet-transform`
- **email-delivery** (Email delivery; v10r: Resend): `mcp-authorization`, `passwordless-auth`, `notification-channels` (conditional), `agentic-parametric-modeling`
- **external-api** (External API; v10r: per pattern, named in when/why): `database-branch-refresh`, `oauth-sign-in`, `notification-channels` (conditional), `multi-source-aggregation`, `name-check`, `mcp-client`, `agent-to-agent`
- **web-worker** (Web worker; v10r: browser dedicated workers): `agentic-parametric-modeling` (conditional), `main-thread-budget`
- **service-worker** (Service worker; v10r: SvelteKit service worker): `service-worker-caching`, `pwa-update-flow`, `web-push`
- **wasm-toolchain** (WebAssembly toolchain; v10r: Rust compiled with wasm-pack): `wasm-compute-kernel`, `architecture-engineering`, `agent-to-agent`
- **container-host** (Container host; v10r: Podman locally, a container host remotely): `wasm-compute-kernel` (conditional), `external-service-runtime`, `architecture-engineering`, `agent-to-agent`
