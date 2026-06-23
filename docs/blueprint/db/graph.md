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

No `neo4j-driver` dependency. The graph layer talks to Neo4j over the **HTTP Query API** via `fetch` — no driver, session, or connection pool. The only entrypoint is `cypher()`.

### Client Configuration

```typescript
// src/lib/server/graph/index.ts
import { env } from '$env/dynamic/private';
import { GRAPH_TIMEOUT_MS } from '$lib/server/config';
import { classifyError, Neo4jError } from './errors';

/** Derive HTTPS host from NEO4J_URI (neo4j+s://xxx → https://xxx) */
function getHttpHost(): string {
  if (!env.NEO4J_URI) throw new Neo4jError('unavailable', 'NEO4J_URI is not set');
  return env.NEO4J_URI.replace(/^neo4j(\+s)?:\/\//, 'https://');
}

function getDatabase(): string {
  return env.NEO4J_DATABASE || 'neo4j';
}

/**
 * Execute a Cypher statement via the Neo4j HTTP Query API.
 * Returns an array of records mapped from the columnar {fields, values} format.
 */
export async function cypher<T = Record<string, unknown>>(
  statement: string,
  parameters?: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<T[]> {
  const url = `${getHttpHost()}/db/${getDatabase()}/query/v2`;
  const timeoutMs = options?.timeoutMs ?? GRAPH_TIMEOUT_MS;

  const body: Record<string, unknown> = { statement };
  if (parameters && Object.keys(parameters).length > 0) body.parameters = parameters;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${env.NEO4J_USERNAME}:${env.NEO4J_PASSWORD}`)}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  // errors.ts classifies HTTP status and Neo4j error codes into typed Neo4jError kinds.
  // ...map result.data.{fields, values} into records and return.
}
```

Basic auth comes from `NEO4J_USERNAME`/`NEO4J_PASSWORD`; the HTTPS host is derived from `NEO4J_URI` (`neo4j+s://` → `https://`). Timeouts use `AbortSignal.timeout()`; errors are classified in `errors.ts` into typed `Neo4jError` kinds.

---

## Graph Model

### Node Types

```cypher
// Page nodes (template documentation)
(:Page {
  id: string,
  path: string,      // '/showcases/ui/tokens'
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

// The shipped relationship vocabulary (src/lib/server/graph/types.ts):
export const RELATIONSHIP_TYPES = [
  'DEPENDS_ON',
  'BELONGS_TO',
  'IMPLEMENTS',
  'INTEGRATES_WITH',
  'REPLACES',
  'DEMONSTRATES',
  'REQUIRES',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
```

---

## Query Helpers

> **Illustrative.** The Page/Feature helpers below are a teaching example, not the shipped API. The real graph layer exposes `cypher(statement, parameters?)` (see Connection Setup) and is organized into `graph/{showcase,rag,catalog}`. Rewrite these against `cypher()` rather than `getSession()`/`session.run()`.

```typescript
// Example only — real reads call cypher() over HTTP, not a session.
import { cypher } from './index';
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

> **Illustrative.** There is no `graph/mutations.ts`. Writes run through `cypher()` like reads; ID prefixes come from `$lib/server/db/id.ts` (`crypto.randomUUID()`-based, no `nanoid`).

```typescript
// Example only — real writes call cypher() over HTTP.
import { cypher } from './index';

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

> **Illustrative.** There is no `scripts/seed-graph.ts`; the live graph is seeded by the catalog-sync flow. The block below shows the shape of a seed, not a shipped script.

```typescript
// Example only — call cypher() per statement; there is no getSession/closeDriver.
import { cypher } from '$lib/server/graph';

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
      CREATE (:Page {id: 'pg_theme', path: '/showcases/ui/tokens', title: 'Theme', category: 'showcase'})
      CREATE (:Page {id: 'pg_ui', path: '/showcases/ui', title: 'UI Components', category: 'showcase'})
      CREATE (:Page {id: 'pg_forms', path: '/showcases/forms', title: 'Forms', category: 'showcase'})
      CREATE (:Page {id: 'pg_data', path: '/showcases/db/relational', title: 'Data', category: 'showcase'})
      CREATE (:Page {id: 'pg_auth', path: '/auth/login', title: 'Login', category: 'auth'})
    `);

    // Create relationships
    await session.run(`
      MATCH (p:Page {path: '/showcases/ui/tokens'}), (f:Feature {name: 'UnoCSS'})
      CREATE (p)-[:USES]->(f)
    `);

    await session.run(`
      MATCH (p:Page {path: '/showcases/ui'}), (f:Feature {name: 'Bits UI'})
      CREATE (p)-[:USES]->(f)
    `);

    await session.run(`
      MATCH (p:Page {path: '/showcases/forms'}), (f1:Feature {name: 'Superforms'}), (f2:Feature {name: 'Valibot'})
      CREATE (p)-[:USES]->(f1), (p)-[:USES]->(f2)
    `);

    await session.run(`
      MATCH (f1:Feature {name: 'Superforms'}), (f2:Feature {name: 'Valibot'})
      CREATE (f1)-[:DEPENDS_ON]->(f2)
    `);

    // Reading order
    await session.run(`
      MATCH (p1:Page {path: '/showcases/ui/tokens'}), (p2:Page {path: '/showcases/ui'}), (p3:Page {path: '/showcases/forms'})
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
// src/routes/showcases/[slug]/+page.server.ts
import { getPageFeatures, getRelatedPages } from '$lib/server/graph/queries';

export async function load({ params }) {
  const path = `/showcases/${params.slug}`;

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
MATCH (p:Page {path: '/showcases/forms'})-[:USES]->(f:Feature)
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
MATCH path = (start:Page {path: '/showcases/ui/tokens'})-[:NEXT*1..5]->(end:Page)
RETURN [node IN nodes(path) | node.title] AS readingOrder
```

### Pages Sharing Features (Recommendations)

```cypher
MATCH (p1:Page {path: '/showcases/forms'})-[:USES]->(f:Feature)<-[:USES]-(p2:Page)
WHERE p1 <> p2
RETURN p2.path, p2.title, count(f) AS sharedFeatures
ORDER BY sharedFeatures DESC
LIMIT 5
```

### Find Prerequisite Pages

```cypher
MATCH path = (target:Page {path: '/showcases/forms'})<-[:REQUIRES*]-(prereq:Page)
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
# Neo4j Aura — the app derives an HTTPS host from NEO4J_URI (neo4j+s:// → https://)
NEO4J_URI="neo4j+s://xxxxxxxx.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="your-aura-password"
NEO4J_DATABASE="neo4j"   # optional, defaults to 'neo4j'
```

---

## File Structure

```
src/lib/server/graph/
├── index.ts      # cypher() — HTTP Query API client
├── types.ts      # RELATIONSHIP_TYPES, toKnowledgeData mapper
├── errors.ts     # Neo4jError + classifyError
├── catalog.ts    # catalog graph helpers
├── showcase/     # showcase queries (verifyConnection → ConnectionInfo)
└── rag/          # Graph RAG retrieval
```

---

## Related

- [relational.md](./relational.md) - Relational data (users, items)
- [README.md](./README.md) - When to use which database
- [../api.md](../api.md) - API endpoints using graph queries
- [../ai/graph-rag.md](../ai/graph-rag.md) - Graph RAG with Neo4j + vector embeddings
