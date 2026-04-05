# GraphQL

GraphQL Yoga v5 patterns for SvelteKit with Drizzle ORM. Schema-first SDL approach.

## Yoga v5 + SvelteKit Integration

```typescript
// src/lib/server/graphql/yoga.ts
import { createSchema, createYoga } from 'graphql-yoga';
import type { RequestEvent } from '@sveltejs/kit';
import DataLoader from 'dataloader';
import { createLoaders } from './loaders';

export const yoga = createYoga<RequestEvent>({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },  // v5 REQUIREMENT — NOT globalThis
  graphiql: process.env.NODE_ENV !== 'production',
  context: (event) => ({
    ...event,               // Full RequestEvent: locals.user, request, url
    loaders: createLoaders(), // Fresh DataLoaders per request
  }),
});
```

```typescript
// src/routes/api/graphql/+server.ts
import type { RequestHandler } from './$types';
import { yoga } from '$lib/server/graphql/yoga';

// Pass full event as context (second arg)
export const GET: RequestHandler = (event) => yoga.handleRequest(event.request, event);
export const POST: RequestHandler = (event) => yoga.handleRequest(event.request, event);
```

### Known Version Issues

| Version | Issue | Fix |
|---------|-------|-----|
| Yoga v5+ | `fetchAPI: globalThis` broken | Use `fetchAPI: { Response }` |
| Yoga v4 | Returns `PonyfilledResponse`, SvelteKit rejects | Upgrade to v5 |
| SvelteKit + Yoga | "Handler should return Response" | Always `fetchAPI: { Response }` |

## Schema Design

### Schema-First (SDL)

```typescript
const typeDefs = `
  type Item {
    id: ID!
    name: String!
    description: String      # nullable — may not exist
    status: ItemStatus!
    tags: [Tag!]!             # non-null list, non-null elements
    created_at: String!
  }

  enum ItemStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
  }

  type Query {
    items(first: Int, after: String, status: ItemStatus): ItemConnection!
    item(id: ID!): Item       # nullable — may not be found
  }

  type Mutation {
    createItem(input: CreateItemInput!): CreateItemResult!
  }

  input CreateItemInput {
    name: String!             # non-null inputs = required
    description: String       # nullable inputs = optional
  }
`;
```

### Nullability Rules

| Field Type | Convention | Reason |
|------------|-----------|--------|
| Output fields | Default nullable | Non-null bubbles errors to parent, killing sibling data |
| Input arguments | Bias non-null | Required = explicit contract |
| List contents | `[Item!]!` | Non-null list with non-null elements is the safe default |
| External data | Always nullable | Third-party sources can fail unpredictably |

**The blast radius rule:** If field A and field B are siblings under a non-null parent, and A's resolver fails, the parent becomes null — killing B's data too. Default to nullable and add `!` only when the data is guaranteed.

## Relay Connection Spec (Pagination)

```graphql
type ItemConnection {
  edges: [ItemEdge!]!
  pageInfo: PageInfo!
}

type ItemEdge {
  node: Item!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String       # nullable: empty list has no cursor
  endCursor: String
}

type Query {
  items(first: Int, after: String, last: Int, before: String): ItemConnection!
}
```

### Resolver

```typescript
Query: {
  items: async (_, { first = 20, after }, ctx) => {
    const decoded = after ? decodeCursor(after) : null;
    // Same seek query as REST cursor pagination
    const items = await getItemsPaginated(ctx.locals.user.id, first, decoded);

    const edges = items.data.map(item => ({
      node: item,
      cursor: encodeCursor(item.createdAt, item.id),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: items.meta.has_more,
        hasPreviousPage: !!after,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
    };
  },
},
```

The same `encodeCursor` / `decodeCursor` from the REST pagination reference works here.

## N+1 Prevention with DataLoader

### Loader Factory (Per-Request)

```typescript
// src/lib/server/graphql/loaders.ts
import DataLoader from 'dataloader';
import { db } from '$lib/server/db';
import { itemTags } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';

export function createLoaders() {
  return {
    tagsByItemId: new DataLoader<string, Tag[]>(async (itemIds) => {
      // ONE query for all IDs in the batch
      const rows = await db.query.itemTags.findMany({
        where: inArray(itemTags.itemId, [...itemIds]),
        with: { tag: true },
      });

      // Group by key to match DataLoader's expected return shape
      const byId = new Map<string, Tag[]>();
      for (const row of rows) {
        const list = byId.get(row.itemId) ?? [];
        list.push(row.tag);
        byId.set(row.itemId, list);
      }

      // MUST return in same order as input IDs
      return itemIds.map(id => byId.get(id) ?? []);
    }),
  };
}
```

### Usage in Resolver

```typescript
Item: {
  tags: async (parent, _, ctx) => {
    return ctx.loaders.tagsByItemId.load(parent.id);
  },
},
```

### When to Use DataLoader vs Drizzle `with`

| Pattern | Use When |
|---------|----------|
| Drizzle `with` in parent resolver | Related data is always needed (eager load) |
| DataLoader in field resolver | Related data is optional (client may not request it) |

## Error Handling

### Pattern A: `errors[]` + `extensions.code` (Default)

```typescript
import { GraphQLError } from 'graphql';

Query: {
  item: async (_, { id }, ctx) => {
    const item = await getItemById(id, ctx.locals.user.id);
    if (!item) {
      throw new GraphQLError('Item not found', {
        extensions: {
          code: 'NOT_FOUND',          // Machine-readable (stable contract)
          http: { status: 404 },      // Yoga sets HTTP status from this
        },
      });
    }
    return item;
  },
},
```

### Pattern B: Errors-as-Data (Union Types)

```graphql
union CreateItemResult = Item | ValidationError | UnauthorizedError

type ValidationError {
  code: String!
  fields: [FieldError!]!
}

type FieldError {
  path: String!
  message: String!
}
```

```typescript
Mutation: {
  createItem: async (_, { input }, ctx) => {
    if (!ctx.locals.user) {
      return { __typename: 'UnauthorizedError', message: 'Login required' };
    }

    const result = v.safeParse(CreateItemSchema, input);
    if (!result.success) {
      return {
        __typename: 'ValidationError',
        code: 'validation_failed',
        fields: result.issues.map(i => ({
          path: i.path?.map(p => p.key).join('.') ?? '',
          message: i.message,
        })),
      };
    }

    return { __typename: 'Item', ...(await createItem(ctx.locals.user.id, result.output)) };
  },
},
```

**Use Pattern A** (default, simpler) for queries and simple mutations. **Use Pattern B** when clients need to programmatically handle specific error types in mutations.

## Security: graphql-armor

```typescript
import { createYoga } from 'graphql-yoga';
import { ArmorPlugin } from '@escape.tech/graphql-armor';

const yoga = createYoga<RequestEvent>({
  schema,
  fetchAPI: { Response },
  plugins: [
    ArmorPlugin({
      maxDepth: { n: 6 },              // Reject deeply nested queries
      maxDirectives: { n: 50 },
      maxAliases: { n: 15 },           // Prevent alias-based DoS
      costLimit: {
        maxCost: 5000,                  // Cost budget per query
        objectCost: 2,
        scalarCost: 1,
        depthCostFactor: 1.5,
      },
      blockFieldSuggestion: { enabled: true },  // Don't leak schema in errors
      introspection: { enabled: process.env.NODE_ENV !== 'production' },
    }),
  ],
});
```

**Start conservative** (depth=4, cost=3000) and raise as needed. Monitor rejected queries in production to tune.

## drizzle-graphql (Scaffolding Only)

```typescript
import { buildSchema } from 'drizzle-graphql';

const { entities } = buildSchema(db);
// Use entities as a starting point, then build custom schema
// DO NOT expose the auto-generated schema directly — it mirrors your DB
```

**Known limitations:** Deeply nested relations (>2 levels) silently truncated; multi-word table names cause type errors; no aggregation support; mutations can't include relational subfields.

## When REST Is Better

- AI tool calls (no query language overhead)
- Webhook endpoints (HTTP semantics are correct)
- File uploads (multipart is awkward in GraphQL)
- Any endpoint where query shape is fixed and known
- Server-to-server communication (simpler debugging)
