# Neo4j Reference

Neo4j-specific implementation details for Velociraptor.

## Contents

- [Driver Setup](#driver-setup) - Connection, TypeScript types
- [Aura Free Tier](#aura-free-tier) - Limits and gotchas
- [Serverless Patterns](#serverless-patterns) - Vercel Fluid Compute
- [Cypher Essentials](#cypher-essentials) - Query syntax
- [Security](#security) - Injection prevention
- [GDS Library](#gds-library) - Graph algorithms

## Driver Setup

### Installation

```bash
bun add neo4j-driver
```

### Connection

```typescript
// $lib/server/neo4j.ts
import neo4j, { type Driver } from 'neo4j-driver';
import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from '$env/static/private';

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      {
        maxConnectionPoolSize: 10,              // Limit for Aura free tier
        maxConnectionLifetime: 60 * 60 * 1000,  // 1 hour
        connectionAcquisitionTimeout: 60_000,   // 1 minute
      }
    );
  }
  return driver;
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
```

### TypeScript Types

```typescript
import type { Node, Relationship, Integer } from 'neo4j-driver';

// Define node interfaces
interface PageNode {
  id: string;
  title: string;
  path: string;
  createdAt: Date;
}

interface ViewedRelationship {
  viewedAt: Date;
  duration: Integer;
}

// Type-safe query
const result = await session.run<{
  p: Node<PageNode>;
  v: Relationship<ViewedRelationship>;
}>(`
  MATCH (u:User {id: $userId})-[v:VIEWED]->(p:Page)
  RETURN p, v
`, { userId });

// Access typed properties
for (const record of result.records) {
  const page = record.get('p').properties;
  console.log(page.title); // TypeScript knows this is string
}
```

### Integer Handling

Neo4j integers may exceed JavaScript's safe integer range:

```typescript
import { int, isInt, toNumber } from 'neo4j-driver';

// Creating integers for Neo4j
await session.run(`
  CREATE (n:Node {count: $count})
`, { count: int(42) });

// Reading integers from Neo4j
const result = await session.run(`MATCH (n) RETURN n.count AS count`);
const count = result.records[0].get('count');

if (isInt(count)) {
  const jsNumber = toNumber(count); // Safe conversion
}
```

### Session Management

```typescript
// Always close sessions
const session = driver.session();
try {
  const result = await session.run(query, params);
  return result.records;
} finally {
  await session.close();
}

// Or use executeRead/executeWrite for automatic retry
const result = await session.executeRead(async (tx) => {
  const res = await tx.run(query, params);
  return res.records;
});
```

## Aura Free Tier

### Limits

| Resource | Limit |
|----------|-------|
| Nodes | 200,000 |
| Relationships | 400,000 |
| Record display | 5,000 per query (use SKIP for pagination) |
| Backups | 1 snapshot at a time |
| API rate | 125 requests/minute |

### Gotchas

1. **5,000 record limit** - Use `SKIP` and `LIMIT` for pagination:
   ```cypher
   MATCH (p:Page)
   RETURN p
   SKIP 5000 LIMIT 5000
   ```

2. **Cold starts** - First query after idle period may be slow (~2-5s)

3. **No GDS in free tier** - Graph Data Science library requires paid tier

4. **Auto-pause** - Instances pause after inactivity (wake on query)

5. **Connection limits** - Keep pool size low (10 recommended)

### Environment Variables

```env
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

Note: Aura uses `neo4j+s://` (TLS) not `bolt://`.

## Serverless Patterns

### Vercel Fluid Compute

Since April 2025, Vercel Fluid Compute allows connection reuse across invocations. Module-level singleton pattern works:

```typescript
// $lib/server/neo4j.ts
// This works with Fluid Compute (default for new Vercel projects)
let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(uri, auth, config);
  }
  return driver;
}
```

### Without Fluid Compute

If Fluid Compute is disabled, create driver per-request:

```typescript
// +page.server.ts
export const load: PageServerLoad = async () => {
  const driver = neo4j.driver(uri, auth, config);
  const session = driver.session();

  try {
    const result = await session.run(query);
    return { data: result.records };
  } finally {
    await session.close();
    await driver.close();
  }
};
```

### Health Check

```typescript
export async function verifyConnection(): Promise<boolean> {
  const driver = getDriver();
  try {
    await driver.verifyConnectivity();
    return true;
  } catch (error) {
    console.error('Neo4j connection failed:', error);
    return false;
  }
}
```

### Graceful Degradation

```typescript
export async function getRelatedPages(pageId: string): Promise<string[]> {
  try {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (p:Page {id: $pageId})-[:RELATED_TO]->(related)
        RETURN related.id AS id
      `, { pageId });

      return result.records.map(r => r.get('id'));
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Neo4j query failed, returning empty:', error);
    return []; // Graceful degradation
  }
}
```

## Cypher Essentials

### CRUD Operations

```cypher
// Create
CREATE (p:Page {id: 'intro', title: 'Introduction', path: '/docs/intro'})

// Read
MATCH (p:Page {id: 'intro'})
RETURN p

// Update
MATCH (p:Page {id: 'intro'})
SET p.title = 'Getting Started', p.updatedAt = datetime()
RETURN p

// Delete (with relationships)
MATCH (p:Page {id: 'intro'})
DETACH DELETE p
```

### MERGE (Upsert)

```cypher
// Create if not exists, match if exists
MERGE (p:Page {id: $pageId})
ON CREATE SET p.createdAt = datetime()
ON MATCH SET p.updatedAt = datetime()
SET p.title = $title
RETURN p
```

### Relationships

```cypher
// Create relationship
MATCH (a:Page {id: 'auth'}), (b:Page {id: 'intro'})
CREATE (a)-[:REQUIRES]->(b)

// Merge relationship (idempotent)
MATCH (a:Page {id: 'auth'}), (b:Page {id: 'intro'})
MERGE (a)-[:REQUIRES]->(b)

// Relationship with properties
MATCH (u:User {id: $userId}), (p:Page {id: $pageId})
CREATE (u)-[:VIEWED {viewedAt: datetime(), duration: $seconds}]->(p)
```

### Aggregation

```cypher
// Count
MATCH (p:Page)
RETURN count(p) AS total

// Group by
MATCH (p:Page)-[:HAS_TAG]->(t:Tag)
RETURN t.name, count(p) AS pageCount
ORDER BY pageCount DESC

// Collect into list
MATCH (p:Page)-[:REQUIRES]->(prereq)
RETURN p.id, collect(prereq.title) AS prerequisites
```

### Path Patterns

```cypher
// Variable length (1 to 5 hops)
MATCH path = (start:Page {id: 'intro'})-[:REQUIRES*1..5]->(end:Page)
RETURN path

// Shortest path
MATCH path = shortestPath(
  (a:Page {id: 'intro'})-[:REQUIRES*]-(b:Page {id: 'advanced'})
)
RETURN [n IN nodes(path) | n.title] AS steps

// All shortest paths
MATCH path = allShortestPaths(
  (a:Page)-[:REQUIRES*]-(b:Page)
)
WHERE a.id = 'intro' AND b.id = 'advanced'
RETURN path
```

### Conditional Logic

```cypher
// CASE expression
MATCH (p:Page)
RETURN p.title,
  CASE
    WHEN p.views > 1000 THEN 'popular'
    WHEN p.views > 100 THEN 'growing'
    ELSE 'new'
  END AS status

// COALESCE for defaults
MATCH (p:Page)
RETURN p.title, coalesce(p.views, 0) AS views

// Optional match (left join equivalent)
MATCH (p:Page {id: $pageId})
OPTIONAL MATCH (p)-[:HAS_TAG]->(t:Tag)
RETURN p, collect(t) AS tags
```

### Datetime

```cypher
// Current datetime
CREATE (e:Event {occurredAt: datetime()})

// Date comparison
MATCH (e:Event)
WHERE e.occurredAt > datetime('2024-01-01')
RETURN e

// Duration
MATCH (e:Event)
WHERE e.occurredAt > datetime() - duration('P7D')  // Last 7 days
RETURN e
```

## Security

### Parameterized Queries (ALWAYS USE)

```typescript
// WRONG - Cypher injection vulnerable
await session.run(`MATCH (p:Page {id: '${userInput}'}) RETURN p`);

// RIGHT - Parameterized
await session.run(`MATCH (p:Page {id: $pageId}) RETURN p`, {
  pageId: userInput
});
```

### What Can Be Parameterized

| Can Parameterize | Cannot Parameterize |
|------------------|---------------------|
| Property values | Labels |
| LIMIT/SKIP values | Relationship types |
| List values | Property keys |

### Dynamic Labels/Types (Cypher 5.26+)

For Neo4j 5.26+, use dynamic features:

```cypher
// Dynamic label
MATCH (n)
WHERE $label IN labels(n)
RETURN n

// Dynamic relationship type
MATCH (a)-[r]->(b)
WHERE type(r) = $relType
RETURN a, r, b
```

### When Dynamic Isn't Available

Sanitize with allowlist:

```typescript
const ALLOWED_LABELS = ['Page', 'Feature', 'User'] as const;

function validateLabel(label: string): string {
  if (!ALLOWED_LABELS.includes(label as any)) {
    throw new Error(`Invalid label: ${label}`);
  }
  return label;
}

// Then use in query (still risky, prefer dynamic features)
const safeLabel = validateLabel(userInput);
await session.run(`MATCH (n:${safeLabel}) RETURN n`);
```

### Connection String Security

```typescript
// Never log connection strings
console.log('Connecting to Neo4j...'); // NOT: console.log(NEO4J_URI);

// Use environment variables
import { NEO4J_URI, NEO4J_PASSWORD } from '$env/static/private';
```

## GDS Library

> Note: GDS requires paid Aura tier. Free tier alternatives shown.

### Without GDS: Manual Recommendations

```cypher
// Collaborative filtering without GDS
MATCH (target:Page {id: $pageId})<-[:VIEWED]-(user)-[:VIEWED]->(other:Page)
WHERE other.id <> $pageId
WITH other, count(DISTINCT user) AS score
ORDER BY score DESC
LIMIT 5
RETURN other.id, other.title, score
```

### Without GDS: Similarity (Jaccard)

```cypher
// Pages with similar tags
MATCH (target:Page {id: $pageId})-[:HAS_TAG]->(t:Tag)
WITH target, collect(t) AS targetTags
MATCH (other:Page)-[:HAS_TAG]->(ot:Tag)
WHERE other <> target
WITH target, other, targetTags, collect(ot) AS otherTags
WITH other,
  size([t IN targetTags WHERE t IN otherTags]) AS intersection,
  size(targetTags) + size(otherTags) - size([t IN targetTags WHERE t IN otherTags]) AS union
RETURN other.id, other.title,
  toFloat(intersection) / union AS jaccard
ORDER BY jaccard DESC
LIMIT 5
```

### With GDS (Paid Tier)

```cypher
// Create in-memory graph projection
CALL gds.graph.project(
  'pageGraph',
  'Page',
  'REQUIRES'
)

// Run PageRank
CALL gds.pageRank.stream('pageGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).title AS page, score
ORDER BY score DESC
LIMIT 10

// Cleanup
CALL gds.graph.drop('pageGraph')
```

## Indexes and Constraints

### Create Constraints

```cypher
// Uniqueness (auto-creates index)
CREATE CONSTRAINT page_id IF NOT EXISTS
FOR (p:Page) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT user_pg_id IF NOT EXISTS
FOR (u:User) REQUIRE u.pgId IS UNIQUE;

// Existence
CREATE CONSTRAINT page_title_exists IF NOT EXISTS
FOR (p:Page) REQUIRE p.title IS NOT NULL;

// Node key (composite)
CREATE CONSTRAINT org_user_key IF NOT EXISTS
FOR (u:User) REQUIRE (u.orgId, u.email) IS NODE KEY;
```

### Create Indexes

```cypher
// Range index for lookups
CREATE INDEX page_path IF NOT EXISTS
FOR (p:Page) ON (p.path);

// Composite index
CREATE INDEX page_category_status IF NOT EXISTS
FOR (p:Page) ON (p.category, p.status);

// Full-text index for search
CREATE FULLTEXT INDEX page_search IF NOT EXISTS
FOR (p:Page) ON EACH [p.title, p.content];
```

### Query Full-Text Index

```cypher
CALL db.index.fulltext.queryNodes('page_search', 'authentication OAuth')
YIELD node, score
RETURN node.title, score
ORDER BY score DESC
LIMIT 10
```

## Migration Pattern

### Schema Migration Script

```typescript
// scripts/neo4j-migrate.ts
import { getDriver } from '$lib/server/neo4j';

const migrations = [
  {
    version: 1,
    up: `
      CREATE CONSTRAINT page_id IF NOT EXISTS
      FOR (p:Page) REQUIRE p.id IS UNIQUE
    `
  },
  {
    version: 2,
    up: `
      CREATE INDEX page_path IF NOT EXISTS
      FOR (p:Page) ON (p.path)
    `
  }
];

async function migrate() {
  const driver = getDriver();
  const session = driver.session();

  try {
    // Get current version
    const result = await session.run(`
      MERGE (m:Migration {id: 'schema'})
      RETURN m.version AS version
    `);
    const currentVersion = result.records[0]?.get('version') ?? 0;

    // Apply pending migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Applying migration ${migration.version}...`);
        await session.run(migration.up);
        await session.run(`
          MATCH (m:Migration {id: 'schema'})
          SET m.version = $version
        `, { version: migration.version });
      }
    }

    console.log('Migrations complete');
  } finally {
    await session.close();
    await driver.close();
  }
}

migrate().catch(console.error);
```

## Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ServiceUnavailable` | Connection failed | Check URI, credentials, network |
| `SessionExpired` | Session used after close | Create new session |
| `TransientError` | Temporary failure | Retry with backoff |
| `ConstraintValidationFailed` | Duplicate key | Check for existing node |

### Debug Queries

```cypher
// Show all constraints
SHOW CONSTRAINTS

// Show all indexes
SHOW INDEXES

// Show execution plan
EXPLAIN MATCH (p:Page)-[:REQUIRES]->(r) RETURN p, r

// Profile query performance
PROFILE MATCH (p:Page)-[:REQUIRES]->(r) RETURN p, r
```

### Connection Issues

```typescript
// Test connection on startup
import { getDriver, verifyConnection } from '$lib/server/neo4j';

export async function handle({ event, resolve }) {
  // Verify on first request (cached after)
  if (!await verifyConnection()) {
    console.error('Neo4j unavailable - graph features disabled');
  }
  return resolve(event);
}
```
