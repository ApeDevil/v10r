# Edge classification — the 88 current `depends_on` edges

Each current edge with the relationship it actually expresses, judged from both records' summaries, docs and code refs. Proposed types are defined in [target-ontology.md](./target-ontology.md#relationships).

| Proposed type | Edges |
|---|---:|
| baseline — drop (platform assumption) | 9 |
| builds_on | 29 |
| composes | 26 |
| composes (optional) | 8 |
| not a dependency — drop or reference | 12 |
| specializes | 4 |

| from | to | to tier | cross-category | proposed type |
|---|---|---|---|---|
| `architecture-mcp-evolution` | `multi-client-core` | deep |  | baseline — drop (platform assumption) |
| `architecture-mcp-authorization` | `architecture-hosted-mcp` | light |  | builds_on |
| `architecture-mcp-authorization` | `identity-passwordless-auth` | light | yes | builds_on |
| `architecture-mcp-authorization` | `anti-abuse-rate-limiting` | light | yes | composes |
| `architecture-agentic-architecture` | `ai-agent-actions` | deep | yes | composes |
| `architecture-agentic-architecture` | `ai-untrusted-content-boundary` | deep | yes | composes |
| `architecture-agentic-architecture` | `architecture-mcp-evolution` | deep |  | composes (optional) |
| `architecture-external-service` | `multi-client-core` | deep |  | baseline — drop (platform assumption) |
| `architecture-external-service` | `deadline-propagation` | deep | yes | composes |
| `architecture-external-service` | `resilience-policy` | deep | yes | composes |
| `architecture-external-service` | `latency-tracing` | deep | yes | composes (optional) |
| `architecture-engineering` | `multi-client-core` | deep |  | not a dependency — drop or reference |
| `architecture-engineering` | `architecture-wasm-kernel` | light |  | not a dependency — drop or reference |
| `architecture-engineering` | `architecture-external-service` | deep |  | not a dependency — drop or reference |
| `architecture-engineering` | `architecture-pattern-mcp` | light |  | not a dependency — drop or reference |
| `ui-latent-cards` | `ui-explosive-discovery` | deep |  | not a dependency — drop or reference |
| `ui-latent-cards` | `ui-primitives` | light |  | baseline — drop (platform assumption) |
| `pattern-index` | `docs-nav-hubs` | deep |  | composes |
| `agent-experience` | `docs-nav-hubs` | deep |  | composes |
| `ai-agent-skills` | `pattern-index` | deep |  | not a dependency — drop or reference |
| `ai-tool-harness` | `multi-client-core` | deep | yes | baseline — drop (platform assumption) |
| `ai-surfaces` | `ai-tool-harness` | deep |  | builds_on |
| `deskbot-approval-gate` | `ai-tool-harness` | deep |  | builds_on |
| `deskbot-approval-gate` | `ai-surfaces` | deep |  | builds_on |
| `deskbot-approval-gate` | `durable-step-execution` | deep | yes | composes |
| `layered-rag` | `multi-client-core` | deep | yes | baseline — drop (platform assumption) |
| `retrieval-endpoints` | `layered-rag` | deep |  | builds_on |
| `ai-turn-trace` | `ai-surfaces` | deep |  | builds_on |
| `jobs-scheduler` | `multi-client-core` | deep | yes | baseline — drop (platform assumption) |
| `product-connection-engine` | `3d-threlte-integration` | light |  | composes (optional) |
| `asset-production-pipeline` | `3d-threlte-integration` | light |  | composes (optional) |
| `asset-production-pipeline` | `derivation-key` | deep | yes | composes |
| `asset-production-pipeline` | `provenance-record` | deep | yes | composes |
| `asset-production-pipeline` | `anti-abuse-rate-limiting` | light | yes | composes |
| `asset-production-pipeline` | `architecture-hosted-mcp` | light | yes | composes (optional) |
| `agentic-parametric-modeling` | `asset-production-pipeline` | deep |  | specializes |
| `agentic-parametric-modeling` | `architecture-mcp-authorization` | deep | yes | composes |
| `agentic-parametric-modeling` | `architecture-hosted-mcp` | light | yes | builds_on |
| `agentic-parametric-modeling` | `ai-mcp-app-provider` | deep | yes | composes (optional) |
| `agentic-parametric-modeling` | `anti-abuse-rate-limiting` | light | yes | composes |
| `agentic-parametric-modeling` | `3d-threlte-integration` | light |  | composes (optional) |
| `desk-workspace` | `multi-client-core` | deep | yes | baseline — drop (platform assumption) |
| `desk-spreadsheet-panel` | `desk-workspace` | deep |  | builds_on |
| `desk-mobile-chrome` | `desk-workspace` | deep |  | builds_on |
| `desk-panel-menus` | `desk-workspace` | deep |  | builds_on |
| `desk-ai-effects` | `desk-workspace` | deep |  | builds_on |
| `desk-ai-effects` | `ai-deskbot` | light | yes | builds_on |
| `desk-explorer` | `desk-workspace` | deep |  | builds_on |
| `virtualized-rendering` | `ui-component-system` | deep | yes | baseline — drop (platform assumption) |
| `velocity-idle-work` | `intent-preloading` | deep |  | not a dependency — drop or reference |
| `stale-while-revalidate` | `hierarchical-cache` | deep |  | specializes |
| `stale-while-revalidate` | `critical-path-deferred-tail` | deep | yes | composes |
| `singleflight` | `hierarchical-cache` | deep |  | builds_on |
| `query-budget` | `performance-budget-ratchet` | deep | yes | composes |
| `critical-path-deferred-tail` | `multi-client-core` | deep | yes | baseline — drop (platform assumption) |
| `heavy-dependency-quarantine` | `performance-budget-ratchet` | deep | yes | composes |
| `side-effect-free-components` | `performance-budget-ratchet` | deep | yes | composes |
| `deadline-propagation` | `resilience-policy` | deep |  | not a dependency — drop or reference |
| `scenario-harness` | `performance-budget-ratchet` | deep |  | composes |
| `scenario-harness` | `resilience-policy` | deep | yes | not a dependency — drop or reference |
| `name-check` | `resilience-policy` | deep | yes | composes |
| `name-check` | `deadline-propagation` | deep | yes | composes |
| `name-check` | `hierarchical-cache` | deep | yes | composes |
| `provenance-record` | `derivation-key` | deep |  | composes |
| `dynamic-attributes` | `versioned-document-session` | deep | yes | composes |
| `asset-rights-manifest` | `source-of-truth-gate` | deep |  | specializes |
| `encryption-key-ring` | `jobs-scheduler` | deep | yes | composes (optional) |
| `url-search-state` | `architecture-state-management` | light |  | specializes |
| `form-draft-recovery` | `forms-superforms-valibot` | light |  | builds_on |
| `ai-untrusted-content-boundary` | `ai-tool-harness` | deep |  | builds_on |
| `ai-untrusted-content-boundary` | `deskbot-approval-gate` | deep |  | composes |
| `ai-agent-actions` | `ai-tool-harness` | deep |  | builds_on |
| `ai-agent-actions` | `ai-surfaces` | deep |  | builds_on |
| `ai-agent-actions` | `deskbot-approval-gate` | deep |  | composes |
| `ai-agent-actions` | `ai-untrusted-content-boundary` | deep |  | composes |
| `ai-agent-actions` | `desk-workspace` | deep | yes | not a dependency — drop or reference |
| `ai-mcp-client` | `ai-tool-harness` | deep |  | builds_on |
| `ai-mcp-client` | `ai-untrusted-content-boundary` | deep |  | builds_on |
| `ai-mcp-client` | `deskbot-approval-gate` | deep |  | builds_on |
| `ai-mcp-app-provider` | `architecture-hosted-mcp` | light | yes | builds_on |
| `ai-agent-to-agent` | `architecture-engineering` | deep | yes | not a dependency — drop or reference |
| `ai-generative-ui` | `ui-component-system` | deep | yes | builds_on |
| `ai-generative-ui` | `ai-untrusted-content-boundary` | deep |  | builds_on |
| `ai-webmcp` | `ai-agent-actions` | deep |  | builds_on |
| `ai-agent-user-interaction` | `ai-agent-actions` | deep |  | builds_on |
| `ai-agent-observability` | `ai-turn-trace` | light |  | builds_on |
| `ai-eval-regression-suite` | `ai-turn-trace` | light |  | builds_on |
| `ai-eval-regression-suite` | `performance-budget-ratchet` | deep | yes | not a dependency — drop or reference |
