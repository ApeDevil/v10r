# v10r pattern dependency graph

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

Every pattern that depends on another or is depended on, in a valid build order (prerequisites first, ties in registry order). `requires` is the pattern's own infrastructure; adopting it also takes everything its dependencies require.

| # | Pattern | Agent skill | Depends on | Requires |
|---|---|---|---|---|
| 1 | `multi-client-core` (deep) | `v10r-foundations` | — | — |
| 2 | `architecture-state-management` (light) | `v10r-foundations` | — | — |
| 3 | `architecture-pattern-mcp` (light) | `v10r-foundations` | — | — |
| 4 | `architecture-hosted-mcp` (light) | `v10r-foundations` | — | — |
| 5 | `architecture-mcp-evolution` (deep) | `v10r-foundations` | `multi-client-core` | — |
| 6 | `architecture-wasm-kernel` (light) | `v10r-foundations` | — | — |
| 7 | `ui-component-system` (deep) | `v10r-foundations` | — | — |
| 8 | `ui-explosive-discovery` (deep) | `v10r-foundations` | — | — |
| 9 | `ui-primitives` (light) | `v10r-foundations` | — | — |
| 10 | `ui-latent-cards` (deep) | `v10r-foundations` | `ui-explosive-discovery`, `ui-primitives` | — |
| 11 | `forms-superforms-valibot` (light) | `v10r-foundations` | — | — |
| 12 | `docs-nav-hubs` (deep) | `v10r-foundations` | — | — |
| 13 | `pattern-index` (deep) | `v10r-foundations` | `docs-nav-hubs` | — |
| 14 | `agent-experience` (deep) | `v10r-foundations` | `docs-nav-hubs` | — |
| 15 | `ai-agent-skills` (deep) | `v10r-foundations` | `pattern-index` | — |
| 16 | `identity-passwordless-auth` (light) | `v10r-identity-safety` | — | — |
| 17 | `anti-abuse-rate-limiting` (light) | `v10r-identity-safety` | — | — |
| 18 | `architecture-mcp-authorization` (deep) | `v10r-foundations` | `architecture-hosted-mcp`, `identity-passwordless-auth`, `anti-abuse-rate-limiting` | — |
| 19 | `ai-tool-harness` (deep) | `v10r-intelligence` | `multi-client-core` | ai-provider |
| 20 | `ai-surfaces` (deep) | `v10r-intelligence` | `ai-tool-harness` | ai-provider |
| 21 | `layered-rag` (deep) | `v10r-intelligence` | `multi-client-core` | postgres, pgvector, ai-provider |
| 22 | `retrieval-endpoints` (deep) | `v10r-intelligence` | `layered-rag` | postgres, pgvector, ai-provider |
| 23 | `ai-turn-trace` (light) | `v10r-intelligence` | `ai-surfaces` | — |
| 24 | `ai-deskbot` (light) | `v10r-intelligence` | — | — |
| 25 | `jobs-scheduler` (deep) | `v10r-features` | `multi-client-core` | postgres |
| 26 | `3d-threlte-integration` (light) | `v10r-features` | — | — |
| 27 | `product-connection-engine` (deep) | `v10r-features` | `3d-threlte-integration` | — |
| 28 | `desk-workspace` (deep) | `v10r-features` | `multi-client-core` | — |
| 29 | `desk-spreadsheet-panel` (light) | `v10r-features` | `desk-workspace` | — |
| 30 | `desk-mobile-chrome` (light) | `v10r-features` | `desk-workspace` | — |
| 31 | `desk-panel-menus` (light) | `v10r-features` | `desk-workspace` | — |
| 32 | `desk-ai-effects` (light) | `v10r-features` | `desk-workspace`, `ai-deskbot` | — |
| 33 | `desk-explorer` (light) | `v10r-features` | `desk-workspace` | — |
| 34 | `intent-preloading` (deep) | `v10r-velocity` | — | — |
| 35 | `virtualized-rendering` (deep) | `v10r-velocity` | `ui-component-system` | — |
| 36 | `velocity-idle-work` (light) | `v10r-velocity` | `intent-preloading` | — |
| 37 | `hierarchical-cache` (deep) | `v10r-velocity` | — | redis |
| 38 | `singleflight` (deep) | `v10r-velocity` | `hierarchical-cache` | — |
| 39 | `critical-path-deferred-tail` (deep) | `v10r-velocity` | `multi-client-core` | — |
| 40 | `stale-while-revalidate` (deep) | `v10r-velocity` | `hierarchical-cache`, `critical-path-deferred-tail` | — |
| 41 | `resilience-policy` (deep) | `v10r-velocity` | — | — |
| 42 | `deadline-propagation` (deep) | `v10r-velocity` | `resilience-policy` | — |
| 43 | `latency-tracing` (deep) | `v10r-velocity` | — | — |
| 44 | `architecture-external-service` (deep) | `v10r-foundations` | `multi-client-core`, `deadline-propagation`, `resilience-policy`, `latency-tracing` | container-host |
| 45 | `architecture-engineering` (deep) | `v10r-foundations` | `multi-client-core`, `architecture-wasm-kernel`, `architecture-external-service`, `architecture-pattern-mcp` | — |
| 46 | `performance-budget-ratchet` (deep) | `v10r-velocity` | — | — |
| 47 | `query-budget` (deep) | `v10r-velocity` | `performance-budget-ratchet` | postgres |
| 48 | `heavy-dependency-quarantine` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — |
| 49 | `side-effect-free-components` (deep) | `v10r-velocity` | `performance-budget-ratchet` | — |
| 50 | `scenario-harness` (deep) | `v10r-velocity` | `performance-budget-ratchet`, `resilience-policy` | — |
| 51 | `name-check` (deep) | `v10r-features` | `resilience-policy`, `deadline-propagation`, `hierarchical-cache` | postgres, third-party-api |
| 52 | `source-of-truth-gate` (deep) | `v10r-integrity` | — | — |
| 53 | `derivation-key` (deep) | `v10r-integrity` | — | postgres |
| 54 | `provenance-record` (deep) | `v10r-integrity` | `derivation-key` | postgres |
| 55 | `asset-production-pipeline` (deep) | `v10r-features` | `3d-threlte-integration`, `derivation-key`, `provenance-record`, `anti-abuse-rate-limiting`, `architecture-hosted-mcp` | — |
| 56 | `durable-step-execution` (deep) | `v10r-integrity` | — | postgres |
| 57 | `deskbot-approval-gate` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces`, `durable-step-execution` | postgres, ai-provider |
| 58 | `versioned-document-session` (deep) | `v10r-integrity` | — | postgres |
| 59 | `dynamic-attributes` (deep) | `v10r-foundations` | `versioned-document-session` | — |
| 60 | `asset-rights-manifest` (deep) | `v10r-integrity` | `source-of-truth-gate` | — |
| 61 | `encryption-key-ring` (deep) | `v10r-identity-safety` | `jobs-scheduler` | postgres, cron |
| 62 | `url-search-state` (deep) | `v10r-foundations` | `architecture-state-management` | — |
| 63 | `form-draft-recovery` (deep) | `v10r-foundations` | `forms-superforms-valibot` | — |
| 64 | `ai-untrusted-content-boundary` (deep) | `v10r-intelligence` | `ai-tool-harness`, `deskbot-approval-gate` | ai-provider |
| 65 | `ai-agent-actions` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `ai-untrusted-content-boundary`, `desk-workspace` | ai-provider |
| 66 | `architecture-agentic-architecture` (deep) | `v10r-foundations` | `ai-agent-actions`, `ai-untrusted-content-boundary`, `architecture-mcp-evolution` | — |
| 67 | `ai-mcp-client` (deep) | `v10r-intelligence` | `ai-tool-harness`, `ai-untrusted-content-boundary`, `deskbot-approval-gate` | third-party-api |
| 68 | `ai-mcp-app-provider` (deep) | `v10r-intelligence` | `architecture-hosted-mcp` | — |
| 69 | `agentic-parametric-modeling` (deep) | `v10r-features` | `asset-production-pipeline`, `architecture-mcp-authorization`, `architecture-hosted-mcp`, `ai-mcp-app-provider`, `anti-abuse-rate-limiting`, `3d-threlte-integration` | web-worker |
| 70 | `ai-agent-to-agent` (deep) | `v10r-intelligence` | `architecture-engineering` | — |
| 71 | `ai-generative-ui` (deep) | `v10r-intelligence` | `ui-component-system`, `ai-untrusted-content-boundary` | ai-provider |
| 72 | `ai-webmcp` (light) | `v10r-intelligence` | `ai-agent-actions` | — |
| 73 | `ai-agent-user-interaction` (light) | `v10r-intelligence` | `ai-agent-actions` | — |
| 74 | `ai-agent-observability` (light) | `v10r-intelligence` | `ai-turn-trace` | — |
| 75 | `ai-eval-regression-suite` (deep) | `v10r-intelligence` | `ai-turn-trace`, `performance-budget-ratchet` | ai-provider, postgres |

## Infrastructure → patterns

- **ai-provider**: `ai-tool-harness`, `ai-surfaces`, `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `ai-untrusted-content-boundary`, `ai-agent-actions`, `ai-generative-ui`, `ai-eval-regression-suite`, `pim-sheet-transform-recipe`
- **container-host**: `architecture-external-service`
- **cron**: `encryption-key-ring`
- **pgvector**: `layered-rag`, `retrieval-endpoints`
- **postgres**: `deskbot-approval-gate`, `layered-rag`, `retrieval-endpoints`, `jobs-scheduler`, `query-budget`, `name-check`, `derivation-key`, `provenance-record`, `durable-step-execution`, `versioned-document-session`, `encryption-key-ring`, `ai-eval-regression-suite`
- **redis**: `hierarchical-cache`
- **third-party-api**: `name-check`, `ai-mcp-client`
- **web-worker**: `agentic-parametric-modeling`, `main-thread-budget`
