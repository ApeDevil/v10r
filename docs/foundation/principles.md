# Principles

Decision-making constraints that drive stack choices. Every technology decision should trace back to one or more of these principles.

---

## Core Principles

### 1. Libraries over services

Own your auth, data, and logic. Prefer self-hosted libraries over managed services.

- No per-user or per-request pricing surprises
- Full control over data and behavior
- No vendor lock-in
- Can run locally without external dependencies

**Exception:** Accept services when self-hosting is impractical (error tracking, graph DB hosting).

---

### 2. Lightweight over feature-rich

Smaller bundles, faster loads, less complexity. Only pay for what you use.

- Bundle size matters for user experience
- Fewer dependencies = fewer vulnerabilities
- Simpler tools are easier to understand and debug
- Avoid "kitchen sink" libraries

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

### 6. No code generation

Runtime-only tooling. Avoid build-step dependencies.

- No generated files to maintain or commit
- No "regenerate after schema change" workflows
- Simpler CI/CD pipelines
- Easier to understand what code does

> **Note on Better Auth:** Better Auth offers both CLI schema generation (`bunx @better-auth/cli generate`) and manual schema definition. This project uses **manual schemas** to maintain this principle. See [stack/data/drizzle.md](../stack/data/drizzle.md) for the hand-written schema approach.

---

### 7. Speed is a feature

Fast runtime, fast builds, fast DX. Performance is non-negotiable.

- User-facing performance affects conversion
- Developer experience affects productivity
- Fast feedback loops improve code quality
- Benchmark before adopting

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
| Does it require code generation? | No code generation |
| Is it fast? | Speed is a feature |

If a tool fails multiple checks, look for alternatives. If no alternative exists, document the exception.

---

## Documenting Exceptions

When a principle must be violated, document it in the relevant stack file:

```markdown
> **Exception to [Principle Name]:** [Tool/choice] violates this principle because [reasoning]. No viable alternative exists that satisfies [requirement].
```

If exceptions accumulate for a principle, reconsider the principle.
