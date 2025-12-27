---
name: db-graph
description: Graph database patterns for Velociraptor. Use when modeling entities with complex relationships, traversing connections, path finding, recommendations, or building knowledge graphs. Covers Neo4j, Cypher queries, graph modeling, index strategies, Graph RAG, and polyglot persistence with PostgreSQL. Essential for any entity relationship or graph traversal work.
---

# Graph Database Patterns

Vendor-agnostic graph database patterns. Currently implemented with Neo4j.

## Contents

- [When to Use Graph](#when-to-use-graph) - Graph vs relational decision
- [Core Concepts](#core-concepts) - Nodes, relationships, properties, labels
- [Data Modeling](#data-modeling) - Design principles and trade-offs
- [Index Strategy](#index-strategy) - Anchor nodes and constraints
- [Query Patterns](#query-patterns) - Traversals, paths, recommendations
- [Graph RAG](#graph-rag) - Knowledge graphs + vector search
- [Polyglot Persistence](#polyglot-persistence) - Keeping Postgres + Neo4j in sync
- [Anti-Patterns](#anti-patterns) - Common mistakes to avoid
- [References](#references) - Vendor-specific details

## When to Use Graph

| Use Case | Database | Why |
|----------|----------|-----|
| Entity relationships, "related to" queries | **Graph** | Native traversal vs recursive SQL CTEs |
| User profiles, sessions, settings | Relational | Structured CRUD, ACID |
| Navigation paths, prerequisites | **Graph** | Built-in pathfinding |
| Recommendations, "users who liked X" | **Graph** | Pattern matching through relationships |
| Transactional records, financial data | Relational | ACID guarantees, SQL tooling |
| Knowledge graphs, semantic connections | **Graph** | Multi-hop reasoning |
| Content CRUD, blog posts | Relational | Simple queries, indexing |

**Rule of thumb:** If you're writing recursive CTEs or self-joins, consider a graph.

## Core Concepts

### Nodes
Entities in your domain. Think dominant nouns.

```
(:Page {id: "auth-setup", title: "Auth Setup", path: "/docs/auth"})
(:Feature {id: "oauth", name: "OAuth Integration"})
(:User {id: "u123", email: "dev@example.com"})
```

### Relationships
First-class connections between nodes. Always typed, always directional (but can traverse either way).

```
(page)-[:REQUIRES]->(prereq)
(user)-[:VIEWED]->(page)
(feature)-[:DEPENDS_ON]->(otherFeature)
```

### Properties
Key-value pairs on nodes or relationships. Use camelCase.

```
// Node properties
(:Page {id: string, title: string, createdAt: datetime})

// Relationship properties
[:VIEWED {viewedAt: datetime, duration: integer}]
```

### Labels
Node categories. Can have multiple. Can add/remove at runtime.

```
(:Page:Featured)           // Multiple labels
(:User:Admin)              // Role as label
(:Product:Seasonal)        // Temporary state as label
```

## Data Modeling

### Design Principles

1. **Nodes = nouns, Relationships = verbs**
   - Good: `(User)-[:PURCHASED]->(Product)`
   - Bad: `(Purchase)` node when you only need the connection

2. **Intermediate nodes unlock insights**
   - Bad: `(Bob)-[:EMAILED]->(Charlie)` - can't query the email
   - Good: `(Bob)-[:SENT]->(Email)-[:TO]->(Charlie)` - email is queryable

3. **Be specific with relationship types**
   - Bad: `[:RELATED]` - tells you nothing
   - Good: `[:REQUIRES]`, `[:DEPENDS_ON]`, `[:SIMILAR_TO]` - enables targeted traversal

4. **Elevate frequently queried properties**
   - If you often filter by a property, consider making it a node
   - Example: Tag as property → Tag as node enables "find all pages with this tag"

### Property vs Node Decision

| Make it a Property | Make it a Node |
|-------------------|----------------|
| Rarely queried | Frequently filtered/joined |
| No relationships needed | Has its own relationships |
| Simple value | Rich metadata |
| One per entity | Many-to-many |

**Example:** `category: "auth"` → `(:Category {name: "auth"})` when you need category relationships.

## Index Strategy

### The Golden Rule

> Indexes exist to find starting points. After that, graph traversal takes over.

### What to Index

1. **Unique identifiers** - Always. Use uniqueness constraints (auto-creates index).
2. **Lookup properties** - Properties used to start queries (path, slug, email).
3. **Filter properties** - Properties in WHERE clauses on anchor nodes.

### What NOT to Index

- Properties only accessed after traversal (downstream data)
- Rarely queried properties
- High-cardinality properties with few lookups

### Constraint Types

```cypher
// Uniqueness constraint (creates index automatically)
CREATE CONSTRAINT page_id IF NOT EXISTS
FOR (p:Page) REQUIRE p.id IS UNIQUE

// Node key (composite uniqueness + existence)
CREATE CONSTRAINT user_org_key IF NOT EXISTS
FOR (u:User) REQUIRE (u.orgId, u.email) IS NODE KEY

// Existence constraint
CREATE CONSTRAINT page_path_exists IF NOT EXISTS
FOR (p:Page) REQUIRE p.path IS NOT NULL
```

**Best Practice:** Create constraints BEFORE loading data.

## Query Patterns

### Basic Traversal

```typescript
// Find all pages that require auth-setup
const result = await session.run(`
  MATCH (p:Page)-[:REQUIRES]->(prereq:Page {id: $prereqId})
  RETURN p.id, p.title
`, { prereqId: 'auth-setup' });
```

### Variable-Length Paths

```typescript
// All prerequisites (any depth)
const result = await session.run(`
  MATCH (p:Page {id: $pageId})-[:REQUIRES*]->(prereq)
  RETURN DISTINCT prereq.id, prereq.title
`, { pageId: 'oauth-setup' });
```

### Shortest Path

```typescript
// Learning path between two pages
const result = await session.run(`
  MATCH path = shortestPath(
    (start:Page {id: $startId})-[:REQUIRES*]-(end:Page {id: $endId})
  )
  RETURN [node IN nodes(path) | node.title] AS steps
`, { startId: 'intro', endId: 'advanced-auth' });
```

### Recommendations (Collaborative Filtering)

```typescript
// Users who viewed X also viewed...
const result = await session.run(`
  MATCH (target:Page {id: $pageId})<-[:VIEWED]-(user)-[:VIEWED]->(other:Page)
  WHERE other.id <> $pageId
  RETURN other.id, other.title, count(*) AS score
  ORDER BY score DESC
  LIMIT 5
`, { pageId: 'auth-setup' });
```

### Pattern Matching

```typescript
// Find pages with specific relationship patterns
const result = await session.run(`
  MATCH (p:Page)-[:REQUIRES]->(req1:Page),
        (p)-[:REQUIRES]->(req2:Page),
        (req1)-[:REQUIRES]->(req2)
  RETURN p.title AS page, req1.title AS req1, req2.title AS req2
`);
```

## Graph RAG

Combine graph traversal with vector search for enhanced retrieval.

### When to Use

| Query Type | Approach |
|------------|----------|
| "What is auth?" | Vector search (semantic) |
| "What depends on auth?" | Graph traversal (relationships) |
| "Explain auth and its prerequisites" | **Hybrid** (both) |

### Basic Pattern

```typescript
// 1. Vector search finds semantically similar content (in Postgres/pgvector)
const semanticMatches = await vectorSearch(query, { limit: 10 });

// 2. Graph expands context via relationships
const expandedContext = await session.run(`
  UNWIND $nodeIds AS nodeId
  MATCH (n {id: nodeId})
  OPTIONAL MATCH (n)-[:REQUIRES|RELATED_TO*1..2]-(related)
  RETURN n, collect(DISTINCT related) AS context
`, { nodeIds: semanticMatches.map(m => m.id) });

// 3. Combine for richer LLM context
const context = mergeResults(semanticMatches, expandedContext);
```

### Knowledge Graph Construction

1. **Entity extraction** - Identify entities from content (pages, features, concepts)
2. **Relationship extraction** - Identify connections between entities
3. **Entity resolution** - Merge duplicates (same entity, different names)
4. **Graph population** - Create nodes and relationships

See `references/neo4j.md` for implementation with Neo4j GDS.

## Polyglot Persistence

### Data Distribution

| Store | Data | Why |
|-------|------|-----|
| PostgreSQL | Users, sessions, content, settings | ACID, CRUD, Better Auth |
| Neo4j | Relationships, paths, recommendations | Traversal, patterns |
| R2 | Images, files, uploads | Object storage |

### Sync Strategies

| Strategy | Consistency | Complexity | Use When |
|----------|-------------|------------|----------|
| Read-time validation | Eventual | Low | Non-critical refs |
| Soft delete + propagation | Eventual | Low-Medium | Need audit trail |
| Transactional outbox | Strong (local) | Medium | Critical events |
| Periodic reconciliation | Eventual | Low | Batch orphan cleanup |

### Reference Pattern

```typescript
// Postgres stores canonical user data
// Neo4j stores user relationships with reference to Postgres ID

// Creating relationship
await session.run(`
  MERGE (u:User {pgId: $userId})
  MERGE (p:Page {id: $pageId})
  CREATE (u)-[:VIEWED {viewedAt: datetime()}]->(p)
`, { userId: pgUser.id, pageId: 'auth-setup' });

// Validating reference on read
const result = await session.run(`
  MATCH (u:User {pgId: $userId})-[:VIEWED]->(p:Page)
  RETURN p.id
`, { userId });

// Verify pgId still exists in Postgres before using
const validPageIds = await validatePgReferences(result.records);
```

### Eventual Consistency

Design for it:
- **Idempotent operations** - Same event processed twice = same result
- **Graceful degradation** - Graph unavailable? Fall back to basic functionality
- **Stale data tolerance** - UI handles "user may have been deleted" states

## Anti-Patterns

### Cartesian Products

```cypher
// WRONG - creates m×n results
MATCH (a:Page), (b:Feature)
WHERE a.category = 'auth'
RETURN a, b

// RIGHT - connect the patterns
MATCH (a:Page)-[:IMPLEMENTS]->(b:Feature)
WHERE a.category = 'auth'
RETURN a, b
```

### Supernodes

```cypher
// WRONG - "Electronics" has millions of connections
(product)-[:IN_CATEGORY]->(electronics:Category)

// RIGHT - create hierarchy
(product)-[:IN_CATEGORY]->(subcategory)-[:CHILD_OF*]->(electronics)
```

### Literal Values in Queries

```typescript
// WRONG - new plan every time
await session.run(`MATCH (p:Page {id: '${pageId}'}) RETURN p`);

// RIGHT - parameterized (plan reuse + security)
await session.run(`MATCH (p:Page {id: $pageId}) RETURN p`, { pageId });
```

### Relational Thinking

```cypher
// WRONG - treating relationships like foreign keys
(:Page {id: "1", prerequisiteIds: ["2", "3"]})

// RIGHT - use actual relationships
(:Page {id: "1"})-[:REQUIRES]->(:Page {id: "2"})
(:Page {id: "1"})-[:REQUIRES]->(:Page {id: "3"})
```

### Missing Intermediate Nodes

```cypher
// WRONG - can't query the viewing event
(user)-[:VIEWED {at: datetime()}]->(page)

// RIGHT - when you need to query views
(user)-[:PERFORMED]->(view:View {at: datetime()})-[:OF]->(page)
```

## Query Optimization

### Profile First

```cypher
// See execution plan without running
EXPLAIN MATCH (p:Page)-[:REQUIRES*]->(prereq) RETURN prereq

// Run and show actual performance
PROFILE MATCH (p:Page)-[:REQUIRES*]->(prereq) RETURN prereq
```

### Key Metrics

- **db hits** - Lower is better. High hits = missing index or inefficient pattern.
- **rows** - Watch for explosion (Cartesian products).
- **Index Seek** vs **Node Scan** - Seek good, Scan bad.

### Optimization Techniques

1. **Index anchor nodes** - First node in MATCH should hit an index
2. **Aggregate early** - Reduce cardinality before expensive operations
3. **Use parameters** - Enables plan caching
4. **Limit variable-length** - `[:REQUIRES*1..5]` not `[:REQUIRES*]`

## References

- **references/neo4j.md** - Neo4j driver, Cypher syntax, Aura configuration, security
