---
name: perf-database
description: Velociraptor database performance — Neon serverless driver (HTTP vs Pool), connection/pooling discipline, Drizzle query shapes (N+1, orderBy+limit), Postgres indexing, pgvector (HNSW, iterative scan), Neo4j Aura HTTP cypher. Use when writing/optimizing queries, schemas, vector search, or graph queries. Project-truth guardrail. (project)
---

# Database Performance (v10r)

Neon serverless Postgres (HTTP driver) + Neo4j Aura (HTTP cypher) + Drizzle + pgvector, on Vercel serverless. A **guardrail and gap-map**.

**Prime directive: measure before you optimize.** `EXPLAIN (ANALYZE, BUFFERS)`, Neon's Query Performance tab, `neon_stat_file_cache`, Neo4j `PROFILE`. A query you haven't EXPLAINed is a guess.

## Contents

- [Invariants (don't break)](#invariants-dont-break)
- [Levers (stack-specific)](#levers-stack-specific)
- [Gotchas that bite](#gotchas-that-bite)
- [Already in v10r](#already-in-v10r)
- [Resolved (2026-06-27)](#resolved-2026-06-27)
- [Out of scope](#out-of-scope)
- [Measure](#measure)
- [References](#references)

## Invariants (don't break)

| Rule | Why |
|------|-----|
| `poolQueryViaFetch = true` is **mandatory** | Bun's WebSocket upgrade is broken; routes pool queries over HTTP. v10r sets it (`db/index.ts:10`). Trades away WS latency + prepared-statement caching — correct for serverless. **Never remove.** |
| **Two-URL discipline** | Pooled (`-pooler`) at runtime; direct only for `db:push`/migrations. Never `.prepare()` through the pooler (`prepared statement "s1" already exists`). v10r uses `db.execute(sql\`…\`)` — safe. |
| `neon()` HTTP for single-shot; Pool/WS only for multi-step interactive transactions | Break-even ~2–3 sequential queries. For atomic multi-query over HTTP use `sql.transaction([...])`. |
| Never stack a client-side `Pool` on Neon's PgBouncer | Double pooling exhausts connections. |
| Drizzle `orderBy` on a relation needs a `limit` | Without it, `db.query.x.findMany({ with: { y: { orderBy } } })` injects a `row_number()` window fn → huge row reads. |
| PgBouncer transaction mode **breaks** `SET`/`RESET`, `LISTEN/NOTIFY`, temp tables, SQL-level `PREPARE`, session advisory locks, `WITH HOLD` cursors | Connections return to the pool per-transaction. |

## Levers (stack-specific)

- **Drizzle relational API** — `db.query.x.findMany({ with })` emits a **single `LEFT JOIN LATERAL`**, not N+1. Use raw `db.execute(sql\`…\`)` for window functions, vector ops, or index hints Drizzle can't express.
- **Indexes** — partial (`WHERE deleted_at IS NULL`), covering (`INCLUDE(...)` → index-only scan), composite (most-selective column first). Low-cardinality columns may be ignored (seq scan is cheaper).
- **pgvector** — HNSW is the default (handles ongoing writes). `SET hnsw.iterative_scan = relaxed_order` (0.8.0+) for **filtered** similarity search — without it a 10%-selective filter + `ef_search=40` returns ~4 rows. `halfvec` halves index size with minimal recall loss. Raise `hnsw.ef_search` at query time for recall.
- **pgvector query shape** — pure `FROM chunk WHERE user_id = $id ORDER BY embedding <=> $vec LIMIT N`. A **JOIN** to filter by user flips the planner to seq scan as the corpus grows — denormalize `user_id` onto the chunk row.
- **Neon LFC** — target >99% hit rate (`neon_stat_file_cache`); a low rate means the working set exceeds compute RAM (upsize, don't re-query).
- **Neo4j Aura** — HTTP Query API (stateless, right for serverless; v10r uses it). **Parameterized** Cypher (literals bypass the plan cache). `UNWIND $batch AS row CREATE …` for bulk. RANGE/TEXT indexes; `USING INDEX` to force; `PROFILE` to find expensive operators.

## Gotchas that bite

- **Neon cold start** — suspends after 5 min idle → 500ms–2s on the first query. Options: Scale plan (disable suspend) / Vercel cron `SELECT 1` every 4 min / accept + show a loader. `sslnegotiation=direct` saves ~120ms per cold connect.
- **Connection exhaustion** — a module-level `Pool` leaks connections across invocations; `poolQueryViaFetch` makes each query stateless (the reason v10r is safe).
- **Drizzle tiny-query overhead** (issue #3001, ~40ms) affects the **prepared-statement** path — v10r uses `db.execute`, so it isn't triggered.

## Already in v10r

`poolQueryViaFetch`; well-indexed schema (composite + partial, e.g. `blog_post_status_published_idx`, soft-delete unique); batched chunk fetch via `sql.join()` (no N+1); HTTP cypher; Drizzle relational where it fits, raw SQL for vector search.

## Resolved (2026-06-27)

> The `rawrag` perf debt logged here is now fixed in-tree. Kept as a record of what changed.

1. **pgvector double-distance + JOIN filter — DONE.** `rag.chunk` carries a denormalized `user_id text NOT NULL` (`chunk_user_idx`), copied from `document.userId` at ingest. Tier queries now filter `c.user_id = $userId` **directly on the chunk row** inside a CTE that computes `embedding <=> $vec` **once**; `rag.document` is JOINed only **after** the `LIMIT`, just to fetch the title (`tiers/contextual.ts`, `parent-child.ts`, `graph.ts`, `rawrag/queries.ts`). `hnsw.iterative_scan = 'relaxed_order'` is set at role level (`db/rag/setup.ts`). EXPLAIN ANALYZE re-measure: ~1010 ms seqscan → **19 ms** (system-docs owner, 3329 chunks) / **0.1 ms** (small user) — the HNSW index is usable again.
2. **Tier-3 timeout on user paths — DONE.** New `USER_GRAPH_TIMEOUT_MS = 3000` (`config.ts`) is passed to the graph-tier expansion on user-facing reads (`tiers/graph.ts`); `GRAPH_TIMEOUT_MS = 30_000` is reserved for background/admin. (Tier-3 is catalog/demo only — the chatbot is tier-1 — so this was a P2.)
3. **`getGraphEntities()` serial call — DONE.** It now short-circuits when no graph/tier-3 chunks survived fusion (`rawrag/index.ts`), instead of firing a Neo4j round-trip for zero payoff.

## Out of scope

B-tree basics, `EXPLAIN` mechanics, `VACUUM`/`REINDEX`, cartesian-product theory → link out / [[drizzle]] / [[db-relational]] / [[db-graph]]. HNSW build tuning at 1M+ vectors (not current scale).

## Measure

`EXPLAIN (ANALYZE, BUFFERS)` (estimate-vs-actual divergence ⇒ `ANALYZE`); Neon Console → Query Performance (resets on suspend — install `pg_stat_statements` on your DB to persist); `neon_stat_file_cache`; Neo4j `PROFILE` for DB-hit counts per operator.

## References

- Skills: [[drizzle]], [[db-relational]], [[db-graph]], [[nrag]]
- `src/lib/server/db/index.ts`, `src/lib/server/rawrag/`, `docs/stack/data/`
