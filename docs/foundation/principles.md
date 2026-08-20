# Principles

Decision-making constraints that drive stack choices. Every technology decision should trace back to one or more of these principles.

---

## Core Principles

### 1. Libraries over services

Own your auth, data, and logic. Prefer libraries over managed services where practical.

- No per-user or per-request pricing surprises
- Full control over data and behavior
- Minimize vendor lock-in
- Behavior lives in the repo — managed services hold state, never logic (there is deliberately ONE database per stack, remote in every environment; see [development-environment.md](./development-environment.md))

**Exceptions:** Accept managed services when they meet these criteria:

| Criterion | Requirement |
|-----------|-------------|
| **Affordable** | Generous free tier, predictable scaling costs |
| **Practical** | Self-hosting is complex or impractical |
| **Swappable** | Uses standard protocols (S3, PostgreSQL, SMTP) OR has clear migration path |
| **Essential** | Provides capability hard to replicate (serverless DB, edge hosting, graph DB) |

Services meeting 3+ criteria are acceptable. Document the trade-off in stack docs.

---

### 2. Lightweight over feature-rich

Smaller bundles, faster loads, less complexity. Only pay for what you use.

The reference repo itself is deliberately broad — the lightweight promise is about each **emulated pattern slice** and each **route's payload**, not the repo's total size. Per-route weight is measured and ratcheted (`src/lib/server/perf/budgets.json`).

- Bundle size matters for user experience
- Fewer dependencies = fewer vulnerabilities
- Simpler tools are easier to understand and debug
- Heavy libraries (Three.js, MapLibre, Chart.js, editors) stay behind deep imports and route splits — never in the shared baseline (the component barrel is a bundle-size boundary)

---

### 3. Standard protocols

Use industry-standard protocols and APIs. Swap vendors without rewriting code.

- S3 API for object storage
- OAuth 2.0 for social auth
- PostgreSQL for relational data
- HTTP caching semantics
- SMTP/REST for email

---

### 4. Free tier friendly

Start at $0/month. Scale costs with actual usage.

- Development must work without paid accounts
- Free tier must be sufficient for MVP/testing
- Pricing should scale linearly with usage
- No upfront commitments required

---

### 5. Svelte-native first

Prefer tools built for Svelte over adapted React libraries.

- Better integration with Svelte's reactivity model
- Smaller bundles (no React compatibility layer)
- Better developer experience
- Maintained by Svelte community

---

### 6. No ungated code generation

Generated artifacts are accepted only under a strict contract: the generator is deterministic, the output is committed (or rebuilt on install, like Paraglide), and a `--check` mode fails the gate when the output goes stale. The pattern-library pages, MCP excerpts, and perf snapshot all live under this contract; what is forbidden is *hidden* generation — output nobody can rebuild, or drift nobody notices.

- Every generated surface has exactly one generator and a staleness check inside `validate` (`patterns:check`, `mcp:excerpts:check`)
- Regeneration is one command (`bun run refresh`), never a hand-edit — generated files say so in their headers
- No generated DB schema: Drizzle tables are hand-written, including Better Auth's

> **Note on Better Auth:** Better Auth offers both CLI schema generation (`bunx @better-auth/cli generate`) and manual schema definition. This project uses **manual schemas**. See [stack/data/drizzle.md](../stack/data/drizzle.md) for the hand-written schema approach.

---

### 7. Speed is a feature

Fast runtime, fast builds, fast DX — measured honestly, not asserted.

- User-facing performance affects conversion
- Developer experience affects productivity
- Fast feedback loops improve code quality
- Benchmark before adopting
- Targets state where we want to be; ratchets stop regression — several targets are red today and `src/lib/server/perf/budgets.json` says so rather than hiding it

---

## Evaluating New Tools

When considering a new dependency:

| Question | Principle |
|----------|-----------|
| Does it require a service account? | Libraries over services |
| What's the bundle/install size? | Lightweight over feature-rich |
| Does it use standard protocols? | Standard protocols |
| Is there a free tier for dev? | Free tier friendly |
| Is there a Svelte-native option? | Svelte-native first |
| Is its codegen deterministic and staleness-gated? | No ungated code generation |
| Is it fast? | Speed is a feature |

If a tool fails multiple checks, look for alternatives. If no alternative exists, document the exception.

---

## Documenting Exceptions

When a principle must be violated, document it in the relevant stack file:

```markdown
> **Exception to [Principle Name]:** [Tool/choice] violates this principle because [reasoning]. No viable alternative exists that satisfies [requirement].
```

If exceptions accumulate for a principle, reconsider the principle.
