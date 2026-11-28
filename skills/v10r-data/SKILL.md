---
name: v10r-data
description: "v10r reference patterns for Data in SvelteKit + TypeScript apps (Databases & Storage; Database Operations). Use when designing, building or reviewing: db connection, schema definition, code organization, graph modeling, graph traversal, cross-store consistency, object storage, caching, valid time, schema migration workflow, branch reset, seeding — before writing it from scratch, read the matching pattern's contraindications, invariants and emulation notes. 13 patterns, 0 with full emulation cards."
license: MIT
metadata:
  source: "v10r pattern-library registry"
  registry-digest: "9c4a3907546a7d98"
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
3. Check *Requires* against the target project's infrastructure, and *Depends on* for prerequisites to build first.
4. Deep card: open `references/<id>.md`. Every *Invariant* MUST still hold after you adapt it; the *Emulation notes* say what to change for a new project. Read the linked docs and code on GitHub when you need the real implementation.
5. Index row (no reference file): its docs page is `https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/<id>.md` — pointers to docs, code and proof, but no recorded invariants, so treat it as orientation, not a contract.
6. When the v10r Pattern MCP is connected (`https://www.v10r.dev/api/mcp/public`, or the local stdio server), `get_pattern {ids, sections}` returns the live card and `get_file_excerpt` the cited code; prefer it over these generated copies.

Maturity is evidence, not opinion: **proven** = a linked test or showcase, verified at a recorded date; **implemented** = the code exists but no proof surface is linked; **planned** = design only. Treat implemented and planned rows as unverified.

## Pattern index

### Databases & Storage

- Postgres client and connection (`databases-postgres-connection`, proven) — Sets up the Drizzle client for PostgreSQL using the Neon serverless driver as the app's single…
- Schema and type inference (`databases-schema-type-inference`, proven) — Drizzle table definitions split across pgSchema() namespaces, one per domain, and re-exported from…
- Queries/mutations split (`databases-queries-mutations-split`, proven) — Splits each domain's database access into separate queries.ts (reads) and mutations.ts (writes)…
- Neo4j connection (`databases-neo4j-connection`, proven) — Connects to a managed Neo4j Aura database over its HTTP Query API via fetch, with no driver…
- Graph modeling (`databases-graph-modeling`, proven) — Defines how entities and their relationships are represented as nodes and edges in the Neo4j graph.
- Graph traversal (`databases-graph-traversal`, proven) — Runs Cypher traversal queries, such as shortest-path and multi-hop lookups, over the modeled graph.
- Polyglot freshness (`databases-polyglot-freshness`, **implemented**) — Documents strategies for keeping references between Postgres and Neo4j valid, since no foreign…
- Object storage (`databases-object-storage`, proven) — S3-compatible object storage on Cloudflare R2, accessed via @aws-sdk/client-s3 with presigned URLs…
- Redis cache client (`databases-cache`, proven) — In-memory key-value store on Upstash Redis, reached over HTTP REST, used for rate limiting, the…
- Temporal data modeling (`temporal-data-modeling`, proven) — A four-rung ladder — last write, transaction time (revision rows), valid time (periods…

### Database Operations

- Dev-to-prod schema workflow (`db-ops-dev-prod-schema-workflow`, **implemented**) — Uses drizzle-kit push for schema changes during development and defers versioned generate/migrate…
- Neon branch refresh from prod (`db-ops-branch-refresh`, proven) — Resets the dev Neon Postgres branch from its production parent through Neon's control-plane API…
- DB bootstrap & seed (`db-ops-bootstrap-seed`, **implemented**) — Scripts and seed modules that populate a fresh database with baseline and sample data.
