# Neo4j

Graph database. Native graph queries, entity relationships, Cypher.

## Why Graph Database

| Query Type | Relational (SQL) | Graph (Cypher) |
|------------|------------------|----------------|
| Simple lookup | Fast | Fast |
| 2-3 level joins | Acceptable | Fast |
| 5+ level traversal | Slow (exponential) | Fast (linear) |
| Path finding | Complex/slow | Native |
| Pattern matching | Difficult | Natural |

Use graph when relationships ARE the data, not just connections between data.

## Why Neo4j

| Aspect | Neo4j | Amazon Neptune | Dgraph |
|--------|-------|----------------|--------|
| Query Language | Cypher (readable) | Gremlin/SPARQL | GraphQL+- |
| Free Tier | Aura Free | None | Cloud only |
| Maturity | 15+ years | Newer | Newer |
| Tooling | Excellent | AWS-only | Limited |

Neo4j wins: mature, readable Cypher, generous free tier, great tooling.

## Provider: Neo4j Aura

| Tier | Nodes | Relationships | Cost |
|------|-------|---------------|------|
| Free | 200K | 400K | $0 |
| Pro | Unlimited | Unlimited | $65+/mo |

See [../vendors.md](../vendors.md#neo4j-aura) for details.

## Data Responsibilities

| Data Type | Store in Neo4j |
|-----------|----------------|
| Entity relationships | Yes |
| Knowledge graphs | Yes |
| Recommendations | Yes |
| Graph RAG context | Yes |
| Users/auth | No (use PostgreSQL) |
| Files | No (use R2) |

## Polyglot Freshness

Cross-database references must remain valid. No foreign keys across stores.

| Pattern | Complexity | Use Case |
|---------|------------|----------|
| Read-time validation | Low | Check refs on read |
| Soft delete + propagation | Low-Medium | Async cascade cleanup |
| Transactional outbox | Medium | Guaranteed event delivery |
| Periodic reconciliation | Low | Batch orphan detection |

See [../../blueprint/db/polyglot-freshness.md](../../blueprint/db/polyglot-freshness.md).

## Related

- [postgres.md](./postgres.md) - Relational data
- [drizzle.md](./drizzle.md) - PostgreSQL ORM
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - Graph RAG integration
