---
name: v10r-data
description: "v10r reference patterns for Data in SvelteKit + TypeScript apps (Databases & Storage; Database Operations). Use when designing, building or reviewing: db connection, schema definition, code organization, graph modeling, graph traversal, cross-store consistency, object storage, valid time, schema migration workflow, branch reset, seeding — before writing it from scratch, read the matching pattern's contraindications, invariants and emulation notes. 12 patterns, 0 with full emulation cards."
license: MIT
metadata:
  source: "v10r pattern-library registry"
  registry-digest: "5763b3ac186c316e"
  generated: "true"
---

# v10r Data patterns

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

## When to use

Use this agent skill when a task in a SvelteKit + TypeScript project touches Databases & Storage, Database Operations and a proven reference implementation would beat inventing one. v10r is a pattern library for *emulation*, not cloning: adapt the shape and keep the invariants; do not copy files wholesale.

To choose among patterns across groups, or to order several, use the `v10r-architecture-selection` agent skill first.

## Method

1. Find the candidate in the index below. Bold, linked rows are deep cards; the rest are index rows.
2. Fitness first: read its *Avoid when* and *Alternatives*. If the target matches a contraindication, or a simpler alternative fits, stop here — the smallest thing that works wins.
3. Check *Needs* against the target project's infrastructure, and the reference's *Relationships*: what it *builds on* (build or map first), what it *composes* (required, conditional or optional constituents) and what it *specializes* (inherited invariants, never built twice).
4. Deep card: open `references/<id>.md`. Every *Invariant* MUST still hold after you adapt it; the *Emulation notes* say what to change for a new project. Read the linked docs and code on GitHub when you need the real implementation.
5. Index row (no reference file): its docs page is `https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/<id>.md` — pointers to docs, code and proof, but no recorded invariants, so treat it as orientation, not a contract.
6. When the v10r Pattern MCP is connected (`https://www.v10r.dev/api/mcp/public`, or the local stdio server), `get_pattern {ids, sections}` returns the live card and `get_file_excerpt` the cited code; prefer it over these generated copies.

Maturity is evidence, not opinion: **proven** = a linked test or showcase, verified at a recorded date; **implemented** = the code exists but no proof surface is linked; **planned** = design only. Treat implemented and planned rows as unverified.

## Pattern index

### Databases & Storage

- Postgres client and connection (`postgres-connection`, proven) — Sets up the Drizzle client for PostgreSQL using the Neon serverless driver as the app's single…
- Schema and type inference (`schema-type-inference`, proven) — Drizzle table definitions split across pgSchema() namespaces, one per domain, and re-exported from…
- Queries/mutations split (`queries-mutations-split`, proven) — Splits each domain's database access into separate queries.ts (reads) and mutations.ts (writes)…
- Neo4j connection (`neo4j-connection`, proven) — Connects to a managed Neo4j Aura database over its HTTP Query API via fetch, with no driver…
- Graph modeling (`graph-modeling`, proven) — Defines how entities and their relationships are represented as nodes and edges in the Neo4j graph.
- Graph traversal (`graph-traversal`, proven) — Runs Cypher traversal queries, such as shortest-path and multi-hop lookups, over the modeled graph.
- Polyglot freshness (`polyglot-freshness`, **implemented**) — Documents strategies for keeping references between Postgres and Neo4j valid, since no foreign…
- Object storage adapter (`object-storage-adapter`, proven) — S3-compatible object storage on Cloudflare R2, accessed via @aws-sdk/client-s3 with presigned URLs…
- Temporal data modeling (`temporal-data-modeling`, proven) — A four-rung ladder — last write, transaction time (revision rows), valid time (periods…

### Database Operations

- Dev-to-prod schema workflow (`dev-to-prod-schema-workflow`, workflow, **implemented**) — Uses drizzle-kit push for schema changes during development and defers versioned generate/migrate…
- Database branch refresh from production (`database-branch-refresh`, workflow, proven) — Resets the dev Neon Postgres branch from its production parent through Neon's control-plane API…
- Database bootstrap and seed (`database-bootstrap-seed`, workflow, **implemented**) — Scripts and seed modules that populate a fresh database with baseline and sample data.
