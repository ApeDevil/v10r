# Neo4j

## What is it?

Native graph database that stores data as nodes, relationships, and properties (not tables). Uses Cypher query language. Provides ACID transactions, clustering, and runtime failover. Neo4j Aura is the fully managed cloud platform.

## What is it for?

- Relationship-heavy queries (social networks, hierarchies, network analysis)
- Recommendation engines (pattern matching across relationships)
- Knowledge graphs (discovering hidden connections)
- Fraud detection (analyzing interconnected entities)
- Graph RAG context for LLM applications

**Rule of thumb:** Use graph when relationships ARE the data, not just connections between data.

## Why was it chosen?

| Query Type | Relational (SQL) | Graph (Cypher) |
|------------|------------------|----------------|
| Simple lookup | Fast | Fast |
| 2-3 level joins | Acceptable | Fast |
| 5+ level traversal | Slow (exponential) | Fast (linear) |
| Path finding | Complex/slow | Native |
| Pattern matching | Difficult | Natural |

**Key advantages:**
- Pre-materialized relationships (no JOIN computation at query time)
- Traverses millions of connections per second
- Readable Cypher syntax vs complex recursive SQL
- 15+ years maturity, excellent tooling

See [vendors.md](../vendors.md#neo4j-aura) for pricing, free tier limits, and provider alternatives.

**Important caveat:** Performance advantage "noticed only for large datasets and joins involving more than 5 tables." Not significant enough to replace relational databases for general use.

## Known limitations

**Scalability:**
- No native horizontal sharding—requires vertical scaling
- Write scalability limited (only master handles writes)
- Not suitable for horizontal partitioning across servers

**Performance trade-offs:**
- Query performance degrades for deeply buried nodes
- Security rules cause overhead (count operations lose fast lookups)
- Relationship type limit: 65K maximum

**When NOT to use:**
- Binary/BLOB storage
- Simple data models without complex relationships
- High write throughput requirements
- SQL compatibility required
- Aggregation-dominated workloads

**Learning curve:**
- Cypher requires learning (not SQL)
- Graph modeling differs from relational normalization

## Related

- [postgres.md](./postgres.md) - Relational data
- [drizzle.md](./drizzle.md) - PostgreSQL ORM
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - Graph RAG integration
