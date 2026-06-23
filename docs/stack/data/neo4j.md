# Neo4j

Graph database (nodes/relationships/Cypher), hosted on **Neo4j Aura**. Backs the Graph RAG retrieval pipeline. See the `db-graph` skill for Cypher patterns.

## Why was it chosen?

- 5+ level traversals stay linear where recursive SQL goes exponential — the RAG pipeline walks the entity graph deeply.

See [vendors.md](../vendors.md#neo4j-aura) for pricing, free tier limits, and provider alternatives.

## Known limitations

- No native horizontal sharding — vertical scaling only; single writer.
- Relationship-type limit: 65K maximum.
- Aura free tier: one instance.

## Related

- [postgres.md](./postgres.md) - Relational data
- [drizzle.md](./drizzle.md) - PostgreSQL ORM
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - Graph RAG integration
