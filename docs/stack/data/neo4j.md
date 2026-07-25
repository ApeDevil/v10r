# Neo4j

Graph database (nodes/relationships/Cypher), hosted on **Neo4j Aura**. Backs the Graph RAG retrieval pipeline. See the `db-graph` skill for Cypher patterns.

## Why was it chosen?

- 5+ level traversals stay linear where recursive SQL goes exponential — the RAG pipeline walks the entity graph deeply.

See [vendors.md](../vendors.md#neo4j-aura) for pricing, free tier limits, and provider alternatives.

## Known limitations

- No native horizontal sharding — vertical scaling only; single writer.
- Relationship-type limit: 65K maximum.
- Aura free tier: one instance.

## Aura free tier: auto-pause & resume

A free Aura instance pauses after a period of inactivity. The first query after a pause pays a resume cost on top of normal query latency:

| Tier | Latency | Meaning |
|------|---------|---------|
| Warm | < 200ms | Instance was already running |
| Waking | 200ms – 2s | Instance was resuming from pause |
| Cold start | > 2s | Instance was fully paused; full resume can take 10–30s |

Live at `/showcases/db/graph/connection` — click Re-test right after a cold start to watch the same instance settle into the Warm tier.

## Shared instance, tenant isolation

Aura free = **one database**, so a single instance holds two graphs at once:

- the public **"Tech Stack" demo graph** — labels `Layer`, `Technology`, `Concept`, `Showcase`
- per-user RAG nodes — `:Entity` / `:Chunk`, owned via an `ownerId` property

A public, unauthenticated showcase visitor must never read another user's RAG data. Two guards enforce that:

- **Label-scoping.** Every public showcase query (`src/lib/server/graph/showcase/queries.ts`) is constrained to the four demo labels — no `CALL db.labels()`, no unscoped `MATCH (n)`. A leaked `:Entity` id returns null.
- **Admin gating.** The arbitrary-Cypher REPL and the reseed action can't be label-constrained, so both are gated behind `isAdmin`.

RAG retrieval paths (`graph/rag/queries.ts` + the rawrag tiers) were already owner-scoped by `ownerId` — no change there.

**Don't copy this naively.** An emulating project must either run the demo graph on a **separate instance** or replicate the label-scoping. A shared instance with unscoped public queries leaks tenant data.

## Related

- [postgres.md](./postgres.md) - Relational data
- [drizzle.md](./drizzle.md) - PostgreSQL ORM
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - Graph RAG integration
