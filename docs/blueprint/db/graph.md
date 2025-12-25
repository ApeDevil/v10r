# Graph Database

Graph data model for relationships, navigation, and future RAG capabilities.

**Provider:** Neo4j via [Neo4j Aura](../../stack/vendors.md#neo4j-aura) (managed) or self-hosted Neo4j Community.

## When to Use Neo4j

| Use Case | Why Graph |
|----------|-----------|
| Entity relationships | Native graph traversal |
| "Related to" queries | Single query vs. recursive SQL |
| Navigation paths | Shortest path algorithms |
| Recommendations | Collaborative filtering |
| Knowledge graphs | Semantic connections |
| Future RAG | Entity extraction + retrieval |

**Rule:** If you're writing recursive CTEs in SQL, consider Neo4j.

---

## Connection Setup

### Driver Installation

```bash
bun add neo4j-driver
```

### Client Configuration

```typescript
// src/lib/server/graph/index.ts
import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(
        process.env.NEO4J_USER!,
        process.env.NEO4J_PASSWORD!
      )
    );
  }
  return driver;
}

export async function getSession(): Promise<Session> {
  return getDriver().session();
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
```

### Graceful Shutdown

```typescript
// src/hooks.server.ts
import { closeDriver } from '$lib/server/graph';

// Close on server shutdown
process.on('SIGTERM', async () => {
  await closeDriver();
  process.exit(0);
});
```

---

## Graph Model

### Node Types

```cypher
// Page nodes (template documentation)
(:Page {
  id: string,
  path: string,      // '/showcase/theme'
  title: string,
  category: string   // 'showcase' | 'app' | 'auth' | 'docs'
})

// Feature nodes (stack components)
(:Feature {
  id: string,
  name: string,      // 'Drizzle', 'UnoCSS', 'Better Auth'
  category: string   // 'auth' | 'database' | 'styling' | 'validation'
})

// Concept nodes (for future RAG)
(:Concept {
  id: string,
  name: string,
  description: string
})
```

### Relationship Types

```cypher
// Page relationships
(:Page)-[:USES]->(:Feature)           // Page uses this stack feature
(:Page)-[:RELATES_TO]->(:Page)        // Related pages
(:Page)-[:REQUIRES]->(:Page)          // Must understand this first

// Feature relationships
(:Feature)-[:DEPENDS_ON]->(:Feature)  // Feature dependency
(:Feature)-[:IMPLEMENTS]->(:Concept)  // Feature implements concept

// Navigation
(:Page)-[:NEXT]->(:Page)              // Suggested reading order
```

---

## TypeScript Types

```typescript
// src/lib/server/graph/types.ts
export interface PageNode {
  id: string;
  path: string;
  title: string;
  category: 'showcase' | 'app' | 'auth' | 'docs';
}

export interface FeatureNode {
  id: string;
  name: string;
  category: 'auth' | 'database' | 'styling' | 'validation' | 'runtime';
}

export interface ConceptNode {
  id: string;
  name: string;
  description: string;
}

export type RelationType =
  | 'USES'
  | 'RELATES_TO'
  | 'REQUIRES'
  | 'DEPENDS_ON'
  | 'IMPLEMENTS'
  | 'NEXT';
```

---

## Query Helpers

```typescript
// src/lib/server/graph/queries.ts
import { getSession } from './index';
import type { PageNode, FeatureNode } from './types';

export async function getPageFeatures(pagePath: string): Promise<FeatureNode[]> {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (p:Page {path: $path})-[:USES]->(f:Feature)
      RETURN f
      `,
      { path: pagePath }
    );
    return result.records.map(r => r.get('f').properties as FeatureNode);
  } finally {
    await session.close();
  }
}

export async function getPagesUsingFeature(featureName: string): Promise<PageNode[]> {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (p:Page)-[:USES]->(f:Feature {name: $name})
      RETURN p
      `,
      { name: featureName }
    );
    return result.records.map(r => r.get('p').properties as PageNode);
  } finally {
    await session.close();
  }
}

export async function getRelatedPages(pagePath: string): Promise<PageNode[]> {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (p:Page {path: $path})-[:RELATES_TO|REQUIRES]-(related:Page)
      RETURN DISTINCT related
      `,
      { path: pagePath }
    );
    return result.records.map(r => r.get('related').properties as PageNode);
  } finally {
    await session.close();
  }
}

export async function getReadingPath(startPath: string, depth: number = 5): Promise<PageNode[]> {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH path = (start:Page {path: $path})-[:NEXT*1..${depth}]->(end:Page)
      RETURN [node IN nodes(path) | node] AS pages
      ORDER BY length(path) DESC
      LIMIT 1
      `,
      { path: startPath }
    );
    if (result.records.length === 0) return [];
    return result.records[0].get('pages').map((n: any) => n.properties as PageNode);
  } finally {
    await session.close();
  }
}

export async function getFeatureDependencies(featureName: string): Promise<FeatureNode[]> {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (f:Feature {name: $name})-[:DEPENDS_ON*]->(dep:Feature)
      RETURN DISTINCT dep
      `,
      { name: featureName }
    );
    return result.records.map(r => r.get('dep').properties as FeatureNode);
  } finally {
    await session.close();
  }
}
```

---

## Write Operations

```typescript
// src/lib/server/graph/mutations.ts
import { getSession } from './index';
import { nanoid } from 'nanoid';

export async function createPage(
  path: string,
  title: string,
  category: string
): Promise<string> {
  const session = await getSession();
  const id = `pg_${nanoid(8)}`;
  try {
    await session.run(
      `
      CREATE (p:Page {id: $id, path: $path, title: $title, category: $category})
      RETURN p
      `,
      { id, path, title, category }
    );
    return id;
  } finally {
    await session.close();
  }
}

export async function linkPageToFeature(
  pagePath: string,
  featureName: string
): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (p:Page {path: $path}), (f:Feature {name: $name})
      MERGE (p)-[:USES]->(f)
      `,
      { path: pagePath, name: featureName }
    );
  } finally {
    await session.close();
  }
}

export async function setNextPage(
  fromPath: string,
  toPath: string
): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (from:Page {path: $from}), (to:Page {path: $to})
      MERGE (from)-[:NEXT]->(to)
      `,
      { from: fromPath, to: toPath }
    );
  } finally {
    await session.close();
  }
}
```

---

## Seed Data

```typescript
// scripts/seed-graph.ts
import { getSession, closeDriver } from '$lib/server/graph';

async function seedGraph() {
  const session = await getSession();

  try {
    // Clear existing data (dev only!)
    await session.run('MATCH (n) DETACH DELETE n');

    // Create features
    await session.run(`
      CREATE (:Feature {id: 'ft_unocss', name: 'UnoCSS', category: 'styling'})
      CREATE (:Feature {id: 'ft_bitsui', name: 'Bits UI', category: 'components'})
      CREATE (:Feature {id: 'ft_superforms', name: 'Superforms', category: 'forms'})
      CREATE (:Feature {id: 'ft_valibot', name: 'Valibot', category: 'validation'})
      CREATE (:Feature {id: 'ft_drizzle', name: 'Drizzle', category: 'database'})
      CREATE (:Feature {id: 'ft_betterauth', name: 'Better Auth', category: 'auth'})
    `);

    // Create pages
    await session.run(`
      CREATE (:Page {id: 'pg_theme', path: '/showcase/theme', title: 'Theme', category: 'showcase'})
      CREATE (:Page {id: 'pg_ui', path: '/showcase/ui', title: 'UI Components', category: 'showcase'})
      CREATE (:Page {id: 'pg_forms', path: '/showcase/forms', title: 'Forms', category: 'showcase'})
      CREATE (:Page {id: 'pg_data', path: '/showcase/data', title: 'Data', category: 'showcase'})
      CREATE (:Page {id: 'pg_auth', path: '/auth/login', title: 'Login', category: 'auth'})
    `);

    // Create relationships
    await session.run(`
      MATCH (p:Page {path: '/showcase/theme'}), (f:Feature {name: 'UnoCSS'})
      CREATE (p)-[:USES]->(f)
    `);

    await session.run(`
      MATCH (p:Page {path: '/showcase/ui'}), (f:Feature {name: 'Bits UI'})
      CREATE (p)-[:USES]->(f)
    `);

    await session.run(`
      MATCH (p:Page {path: '/showcase/forms'}), (f1:Feature {name: 'Superforms'}), (f2:Feature {name: 'Valibot'})
      CREATE (p)-[:USES]->(f1), (p)-[:USES]->(f2)
    `);

    await session.run(`
      MATCH (f1:Feature {name: 'Superforms'}), (f2:Feature {name: 'Valibot'})
      CREATE (f1)-[:DEPENDS_ON]->(f2)
    `);

    // Reading order
    await session.run(`
      MATCH (p1:Page {path: '/showcase/theme'}), (p2:Page {path: '/showcase/ui'}), (p3:Page {path: '/showcase/forms'})
      CREATE (p1)-[:NEXT]->(p2)-[:NEXT]->(p3)
    `);

    console.log('Graph seed complete');
  } finally {
    await session.close();
    await closeDriver();
  }
}

seedGraph();
```

---

## API Integration

```typescript
// src/routes/api/graph/features/+server.ts
import { json } from '@sveltejs/kit';
import { getPagesUsingFeature } from '$lib/server/graph/queries';

export async function GET({ url }) {
  const name = url.searchParams.get('name');
  if (!name) {
    return json({ error: 'Feature name required' }, { status: 400 });
  }

  const pages = await getPagesUsingFeature(name);
  return json({ pages });
}
```

```typescript
// src/routes/showcase/[slug]/+page.server.ts
import { getPageFeatures, getRelatedPages } from '$lib/server/graph/queries';

export async function load({ params }) {
  const path = `/showcase/${params.slug}`;

  const [features, related] = await Promise.all([
    getPageFeatures(path),
    getRelatedPages(path)
  ]);

  return { features, related };
}
```

---

## Useful Queries

### Find All Features a Page Uses

```cypher
MATCH (p:Page {path: '/showcase/forms'})-[:USES]->(f:Feature)
RETURN f.name, f.category
```

### Find All Pages Using a Feature

```cypher
MATCH (p:Page)-[:USES]->(f:Feature {name: 'Valibot'})
RETURN p.path, p.title
```

### Feature Dependency Tree

```cypher
MATCH path = (f:Feature {name: 'Superforms'})-[:DEPENDS_ON*]->(dep:Feature)
RETURN path
```

### Suggested Reading Path

```cypher
MATCH path = (start:Page {path: '/showcase/theme'})-[:NEXT*1..5]->(end:Page)
RETURN [node IN nodes(path) | node.title] AS readingOrder
```

### Pages Sharing Features (Recommendations)

```cypher
MATCH (p1:Page {path: '/showcase/forms'})-[:USES]->(f:Feature)<-[:USES]-(p2:Page)
WHERE p1 <> p2
RETURN p2.path, p2.title, count(f) AS sharedFeatures
ORDER BY sharedFeatures DESC
LIMIT 5
```

### Find Prerequisite Pages

```cypher
MATCH path = (target:Page {path: '/showcase/forms'})<-[:REQUIRES*]-(prereq:Page)
RETURN [node IN nodes(path) | node.title] AS prerequisites
```

---

## Constraints & Indexes

Run once on database setup:

```cypher
// Unique constraints
CREATE CONSTRAINT page_path_unique IF NOT EXISTS
FOR (p:Page) REQUIRE p.path IS UNIQUE;

CREATE CONSTRAINT feature_name_unique IF NOT EXISTS
FOR (f:Feature) REQUIRE f.name IS UNIQUE;

// Indexes for faster lookups
CREATE INDEX page_category IF NOT EXISTS
FOR (p:Page) ON (p.category);

CREATE INDEX feature_category IF NOT EXISTS
FOR (f:Feature) ON (f.category);
```

---

## Environment Variables

```bash
# Local (container)
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="password"

# Production (Neo4j Aura)
NEO4J_URI="neo4j+s://xxxxxxxx.databases.neo4j.io"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="your-aura-password"
```

---

## File Structure

```
src/lib/server/graph/
├── index.ts      # Driver connection
├── types.ts      # Node/relationship types
├── queries.ts    # Read operations
└── mutations.ts  # Write operations

scripts/
└── seed-graph.ts # Development seeding
```

---

## Related

- [relational.md](./relational.md) - Relational data (users, items)
- [README.md](./README.md) - When to use which database
- [../api.md](../api.md) - API endpoints using graph queries
- [../ai/graph-rag.md](../ai/graph-rag.md) - Graph RAG with Neo4j + vector embeddings
