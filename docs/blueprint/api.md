# API Architecture

REST endpoints with SvelteKit +server.ts files.

---

## Strategy

**File-based API routes** using Web Standards (Request/Response).

| Aspect | Approach |
|--------|----------|
| Endpoints | `+server.ts` files |
| Validation | Valibot schemas |
| Errors | `error()` helper + status codes |
| Documentation | OpenAPI (optional) |
| CORS | hooks.server.ts |

---

## Basic Endpoints

### File Structure

```
src/routes/
├── api/
│   ├── health/
│   │   └── +server.ts          # GET /api/health
│   ├── items/
│   │   ├── +server.ts          # GET, POST /api/items
│   │   └── [id]/
│   │       └── +server.ts      # GET, PUT, DELETE /api/items/:id
│   └── upload/
│       └── +server.ts          # POST /api/upload
```

### GET Handler

```typescript
// src/routes/api/items/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ url }) => {
  const limit = Number(url.searchParams.get('limit')) || 20;
  const offset = Number(url.searchParams.get('offset')) || 0;

  const results = await db
    .select()
    .from(items)
    .limit(limit)
    .offset(offset);

  return json({
    data: results,
    meta: { limit, offset },
  });
};
```

### POST Handler

```typescript
// src/routes/api/items/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import * as v from 'valibot';

const CreateItemSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  description: v.optional(v.string()),
  price: v.pipe(v.number(), v.minValue(0)),
});

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  const result = v.safeParse(CreateItemSchema, body);
  if (!result.success) {
    error(400, {
      message: 'Validation failed',
      errors: result.issues.map(i => ({
        path: i.path?.map(p => p.key).join('.'),
        message: i.message,
      })),
    });
  }

  const [item] = await db
    .insert(items)
    .values(result.output)
    .returning();

  return json(item, { status: 201 });
};
```

### PUT Handler

```typescript
// src/routes/api/items/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';

const UpdateItemSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
  description: v.optional(v.string()),
  price: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json();

  const result = v.safeParse(UpdateItemSchema, body);
  if (!result.success) {
    error(400, { message: 'Validation failed' });
  }

  const [updated] = await db
    .update(items)
    .set({ ...result.output, updatedAt: new Date() })
    .where(eq(items.id, params.id))
    .returning();

  if (!updated) {
    error(404, { message: 'Item not found' });
  }

  return json(updated);
};
```

### DELETE Handler

```typescript
// src/routes/api/items/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
  const [deleted] = await db
    .delete(items)
    .where(eq(items.id, params.id))
    .returning();

  if (!deleted) {
    error(404, { message: 'Item not found' });
  }

  return json({ success: true });
};
```

---

## Request Handling

### URL Parameters

```typescript
export const GET: RequestHandler = async ({ params, url }) => {
  // Route params: /api/items/[id] → params.id
  const { id } = params;

  // Query params: /api/items?sort=name&order=desc
  const sort = url.searchParams.get('sort') ?? 'createdAt';
  const order = url.searchParams.get('order') ?? 'desc';

  // ...
};
```

### Request Body

```typescript
export const POST: RequestHandler = async ({ request }) => {
  // JSON body
  const json = await request.json();

  // Form data
  const formData = await request.formData();
  const name = formData.get('name');
  const file = formData.get('file') as File;

  // Raw text
  const text = await request.text();

  // ...
};
```

### Headers and Cookies

```typescript
export const GET: RequestHandler = async ({ request, cookies }) => {
  // Request headers
  const auth = request.headers.get('Authorization');
  const contentType = request.headers.get('Content-Type');

  // Cookies
  const session = cookies.get('session');

  // Response with custom headers
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=3600',
      'X-Custom-Header': 'value',
    },
  });
};
```

---

## Validation

### Valibot Schemas

```typescript
// src/lib/server/http/schemas.ts
import * as v from 'valibot';

// Reusable schemas
export const PaginationSchema = v.object({
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)), 20),
  offset: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
});

export const IdParamSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
});

// Entity schemas
export const CreateItemSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  description: v.optional(v.pipe(v.string(), v.maxLength(1000))),
  price: v.pipe(v.number(), v.minValue(0)),
  tags: v.optional(v.array(v.string())),
});

export const UpdateItemSchema = v.partial(CreateItemSchema);
```

### Validation Helper

```typescript
// src/lib/server/http/validate.ts
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

export function validate<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
  data: unknown
): v.InferOutput<T> {
  const result = v.safeParse(schema, data);

  if (!result.success) {
    error(400, {
      message: 'Validation failed',
      errors: result.issues.map(issue => ({
        path: issue.path?.map(p => p.key).join('.') ?? '',
        message: issue.message,
      })),
    });
  }

  return result.output;
}

export async function validateBody<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  request: Request,
  schema: T
): Promise<v.InferOutput<T>> {
  try {
    const body = await request.json();
    return validate(schema, body);
  } catch (e) {
    if (e instanceof SyntaxError) {
      error(400, { message: 'Invalid JSON' });
    }
    throw e;
  }
}

export function validateQuery<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  url: URL,
  schema: T
): v.InferOutput<T> {
  const params = Object.fromEntries(url.searchParams);
  return validate(schema, params);
}
```

### Usage

```typescript
import { validateBody, validateQuery } from '$lib/server/http/validate';
import { CreateItemSchema, PaginationSchema } from '$lib/server/http/schemas';

export const GET: RequestHandler = async ({ url }) => {
  const { limit, offset } = validateQuery(url, PaginationSchema);
  // ...
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await validateBody(request, CreateItemSchema);
  // data is fully typed
};
```

---

## Error Handling

### Expected Errors

```typescript
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const item = await db.query.items.findFirst({
    where: eq(items.id, params.id),
  });

  if (!item) {
    // 4xx errors - client's fault
    error(404, { message: 'Item not found' });
  }

  if (!item.published) {
    error(403, { message: 'Item not accessible' });
  }

  return json(item);
};
```

### Error Response Format

```typescript
// Consistent error shape
interface ApiError {
  message: string;
  code?: string;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

// Usage
error(400, {
  message: 'Validation failed',
  code: 'VALIDATION_ERROR',
  errors: [
    { path: 'email', message: 'Invalid email format' },
    { path: 'password', message: 'Must be at least 8 characters' },
  ],
});
```

### Global Error Handler

```typescript
// src/hooks.server.ts
import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  // Log unexpected errors (5xx)
  if (status >= 500) {
    console.error('Server error:', error);
    // Send to error tracking service
    // await sentry.captureException(error);
  }

  return {
    message: status >= 500 ? 'Internal server error' : message,
    code: status >= 500 ? 'INTERNAL_ERROR' : undefined,
  };
};
```

---

## Authentication

### Protected Endpoints

```typescript
// src/routes/api/items/+server.ts
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
  // Check auth from hooks.server.ts
  if (!locals.user) {
    error(401, { message: 'Unauthorized' });
  }

  // Check permissions
  if (!locals.user.canCreateItems) {
    error(403, { message: 'Forbidden' });
  }

  // Proceed with authenticated request
  const data = await validateBody(request, CreateItemSchema);
  // ...
};
```

### API Key Authentication

> **Security:** Never use `===` for secret comparison—it's vulnerable to timing attacks. Use `crypto.timingSafeEqual()` instead.

```typescript
// src/lib/server/auth/api-key.ts
import { timingSafeEqual } from 'crypto';
import { API_SECRET_KEY } from '$env/static/private';

/**
 * Timing-safe API key verification.
 * Prevents timing attacks by ensuring constant-time comparison.
 */
export function verifyApiKey(providedKey: string | null): boolean {
  if (!providedKey || !API_SECRET_KEY) {
    return false;
  }

  // Length check first (not timing-safe, but prevents unnecessary encoding)
  if (providedKey.length !== API_SECRET_KEY.length) {
    return false;
  }

  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(API_SECRET_KEY);

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
```

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { verifyApiKey } from '$lib/server/auth/api-key';

export const handle: Handle = async ({ event, resolve }) => {
  // Check for API routes
  if (event.url.pathname.startsWith('/api')) {
    const apiKey = event.request.headers.get('X-API-Key');

    if (verifyApiKey(apiKey)) {
      event.locals.apiAuth = true;
    }
  }

  return resolve(event);
};
```

---

## CORS

### Global CORS in Hooks

CORS is implemented as a composable handler using `sequence`. See [auth.md](./auth.md) for the full hooks.server.ts setup.

```typescript
// src/lib/server/hooks/cors.ts
import type { Handle } from '@sveltejs/kit';

const ALLOWED_ORIGINS = [
  'https://example.com',
  'https://app.example.com',
];

export const corsHandle: Handle = async ({ event, resolve }) => {
  // Handle preflight requests
  if (event.request.method === 'OPTIONS') {
    const origin = event.request.headers.get('Origin');

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
  }

  const response = await resolve(event);

  // Add CORS headers to API responses
  if (event.url.pathname.startsWith('/api')) {
    const origin = event.request.headers.get('Origin');

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  return response;
};
```

### Composing with Auth

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { authHandle, sessionHandle } from '$lib/server/hooks/auth';
import { corsHandle } from '$lib/server/hooks/cors';

// Order matters: CORS first (handles OPTIONS), then auth
export const handle = sequence(corsHandle, authHandle, sessionHandle);
```

**Why `sequence`?** SvelteKit only allows one `handle` export. Use `sequence` to compose CORS, auth, logging, and other middleware-like handlers.

### Per-Route CORS

```typescript
// src/routes/api/public/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const data = { /* ... */ };

  return json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
};

// Handle OPTIONS for this specific route
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
};
```

---

## Response Helpers

### Standard Response Wrapper

`$lib/server/http/response.ts` exports the envelope helpers. Success is `{ data }`; error is `{ error: { code, message, fields? } }`.

```typescript
// src/lib/server/http/response.ts
export function apiOk<T>(data: T, status = 200);      // { data } → 200
export function apiCreated<T>(data: T);                // { data } → 201
export function apiNoContent();                        // empty body → 204
export function apiError(status, code, message, fields?); // { error: { code, message, fields? } }
export function apiValidationError(issues);            // Valibot issues → 400 validation_failed
```

> **Rule:** Never use SvelteKit `error()` in `+server.ts` — it produces a `{ message }` shape. Always use these helpers for a consistent contract.

### Usage

```typescript
import { apiOk, apiError } from '$lib/server/http/response';

export const GET: RequestHandler = async ({ url }) => {
  const item = await getItem(url.searchParams.get('id'));
  if (!item) return apiError(404, 'not_found', 'Item not found.');
  return apiOk(item);
};
```

### Pagination

`$lib/server/http/pagination.ts` provides both styles. Offset-based: `parsePagination(url)` + `apiPaginated(items, total, params)` → `{ data: { items, pagination: { page, pageSize, total, totalPages } } }`. Cursor-based: `parseLimit`/`parseCursor`/`encodeCursor`/`decodeCursor` + `paginatedResponse(items, limit, cursorFn)` → `{ items, has_more, cursor? }`.

```typescript
import { parseLimit, parseCursor, paginatedResponse } from '$lib/server/http/pagination';
import { apiOk } from '$lib/server/http/response';

export const GET: RequestHandler = async ({ url }) => {
  const limit = parseLimit(url);
  const cursor = parseCursor(url);

  // Fetch limit + 1 to detect another page.
  const rows = await queryItems(cursor, limit + 1);

  return apiOk(paginatedResponse(rows, limit, (item) => ({ id: item.id })));
};
```

---

## File Uploads

> **Security:** Never trust client-provided MIME types (`file.type`). Validate actual file content using magic bytes.

**Required:** `"file-type": "^19.x"` — see [development-environment.md](../foundation/development-environment.md)

```typescript
// src/lib/server/upload/validate.ts
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

interface ValidatedFile {
  buffer: Buffer;
  mimeType: AllowedMimeType;
  extension: string;
}

/**
 * Validates file content using magic bytes, not client-provided MIME type.
 * Prevents attackers from uploading malicious files with spoofed extensions.
 */
export async function validateFileContent(file: File): Promise<ValidatedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    throw new Error('Unable to determine file type');
  }

  if (!ALLOWED_MIME_TYPES.includes(detected.mime as AllowedMimeType)) {
    throw new Error(`File type ${detected.mime} not allowed`);
  }

  return {
    buffer,
    mimeType: detected.mime as AllowedMimeType,
    extension: detected.ext,
  };
}
```

```typescript
// src/routes/api/upload/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateFileContent } from '$lib/server/upload/validate';
import { uploadToR2 } from '$lib/server/storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    error(401, { message: 'Unauthorized' });
  }

  const formData = await request.formData();
  const fileEntry = formData.get('file');

  // Validate file exists and is actually a File (not a string)
  if (!fileEntry || typeof fileEntry === 'string') {
    error(400, { message: 'No file provided' });
  }

  const file = fileEntry as File;

  if (file.size > MAX_FILE_SIZE) {
    error(400, { message: 'File too large (max 10MB)' });
  }

  // Validate actual file content using magic bytes
  let validated;
  try {
    validated = await validateFileContent(file);
  } catch (e) {
    error(400, { message: e instanceof Error ? e.message : 'Invalid file type' });
  }

  // Generate safe filename (never use client-provided name)
  const safeFilename = `${crypto.randomUUID()}.${validated.extension}`;

  const url = await uploadToR2(validated.buffer, safeFilename, locals.user.id);

  return json({ url }, { status: 201 });
};
```

---

## Rate Limiting

Limiters are built with the `createLimiter` factory (sliding window over `@upstash/ratelimit`, backed by Upstash Redis) in `$lib/server/http/rate-limit.ts`. See [abuse/rate-limits.md](./abuse/rate-limits.md) for the full limiter catalog.

```typescript
// src/routes/api/items/+server.ts
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';

const limiter = createLimiter('rl:items', 30, '1 m');

export const POST: RequestHandler = async (event) => {
  const { success, reset } = await limiter.limit(event.getClientAddress());
  if (!success) return rateLimitResponse(reset);

  // ...
};
```

---

## OpenAPI Documentation (Optional)

### Using JSDoc Annotations

```typescript
// src/routes/api/items/+server.ts

/**
 * @swagger
 * /api/items:
 *   get:
 *     summary: List all items
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of items
 */
export const GET: RequestHandler = async ({ url }) => {
  // ...
};
```

### Tools

- **sveltekit-openapi-generator** - Generates OpenAPI from JSDoc
- **swagger-ui-svelte** - Swagger UI component for Svelte
- **sveltekit-api** - Type-safe endpoints with auto OpenAPI

---

## GraphQL (Optional)

> Illustrative — no GraphQL endpoint exists in the codebase: no `graphql`/`graphql-yoga` dependency, no `/api/graphql` route. This section is a reference pattern for *if* a specific need ever arises; the live API surface is REST + SSE only.

GraphQL is **not** the primary API pattern for Velociraptor. REST endpoints with `+server.ts` are simpler and sufficient for most use cases.

### When to Consider GraphQL

| Use Case | REST | GraphQL |
|----------|------|---------|
| Simple CRUD | **Better** | Overkill |
| Mobile apps (bandwidth) | Good | **Better** |
| Complex nested queries | Multiple requests | **Single query** |
| Rapid frontend iteration | Schema changes | **Flexible queries** |
| Public API | **Simpler** | More powerful |

### Setup with GraphQL Yoga

GraphQL Yoga is lightweight (~15KB) and works well with SvelteKit.

**Would require:** `"graphql": "^16.x"`, `"graphql-yoga": "^5.x"` (not installed) — see [development-environment.md](../foundation/development-environment.md)

### Schema Definition

```typescript
// src/lib/server/graphql/schema.ts
import { createSchema } from 'graphql-yoga';
import { db } from '$lib/server/db';
import { items, tags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const schema = createSchema({
  typeDefs: `
    type Item {
      id: ID!
      title: String!
      description: String
      status: ItemStatus!
      tags: [Tag!]!
      createdAt: String!
    }

    type Tag {
      id: ID!
      name: String!
      color: String!
    }

    enum ItemStatus {
      DRAFT
      PUBLISHED
      ARCHIVED
    }

    type Query {
      items(status: ItemStatus): [Item!]!
      item(id: ID!): Item
    }

    type Mutation {
      createItem(title: String!, description: String): Item!
      updateItem(id: ID!, title: String, description: String, status: ItemStatus): Item
      deleteItem(id: ID!): Boolean!
    }
  `,
  resolvers: {
    Query: {
      items: async (_, { status }) => {
        const query = status
          ? db.query.items.findMany({ where: eq(items.status, status.toLowerCase()) })
          : db.query.items.findMany();
        return query;
      },
      item: async (_, { id }) => {
        return db.query.items.findFirst({ where: eq(items.id, id) });
      },
    },
    Mutation: {
      createItem: async (_, { title, description }, context) => {
        if (!context.user) throw new Error('Unauthorized');
        const [item] = await db.insert(items).values({
          id: createId.item(),
          userId: context.user.id,
          title,
          description,
        }).returning();
        return item;
      },
      // ... other mutations
    },
    Item: {
      tags: async (parent) => {
        return db.query.itemTags.findMany({
          where: eq(itemTags.itemId, parent.id),
          with: { tag: true },
        }).then(results => results.map(r => r.tag));
      },
    },
  },
});
```

### SvelteKit Integration

```typescript
// src/routes/api/graphql/+server.ts
import { createYoga } from 'graphql-yoga';
import { schema } from '$lib/server/graphql/schema';
import type { RequestHandler } from './$types';

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  // Yoga v5 expects the Fetch constructors as an object; `fetchAPI: globalThis` breaks
  fetchAPI: { Response },
});

export const GET: RequestHandler = async ({ request, locals }) => {
  return yoga.handleRequest(request, { user: locals.user });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  return yoga.handleRequest(request, { user: locals.user });
};
```

### GraphiQL Playground

GraphQL Yoga includes GraphiQL by default. Visit `/api/graphql` in your browser.

To disable in production:

```typescript
const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  graphiql: process.env.NODE_ENV !== 'production',
});
```

### Client Usage

```typescript
// src/lib/graphql-client.ts
export async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const { data, errors } = await response.json();
  if (errors) throw new Error(errors[0].message);
  return data;
}
```

```svelte
<script lang="ts">
  import { graphql } from '$lib/graphql-client';

  const loadItems = async () => {
    const data = await graphql<{ items: Item[] }>(`
      query {
        items(status: PUBLISHED) {
          id
          title
          tags { name color }
        }
      }
    `);
    return data.items;
  };
</script>
```

### When NOT to Use GraphQL

- Simple CRUD operations → use REST
- Public APIs → REST is more cacheable
- Server-to-server communication → REST is simpler
- You don't have complex nested data → REST is sufficient

**Velociraptor's recommendation:** Start with REST. Add GraphQL only if you have specific needs (mobile optimization, complex nested queries, or a public API for developers). If it ever ships, add `graphql-armor` (depth/cost limits, introspection off in prod) the same day — a public GraphQL endpoint without it is an unbounded-query DoS surface.

---

## gRPC / Typed RPC (Not Feasible Here)

Native gRPC cannot be hosted on this stack: Vercel functions run on a Lambda-based runtime with no end-to-end HTTP/2 trailers, which the gRPC wire protocol requires. There is also nothing to dial — every external service (Neon, Neo4j Aura Query API, Upstash, R2, Gemini/Groq/OpenAI) speaks HTTP/JSON by deliberate serverless design, and the AI providers stream over SSE.

Connect-RPC (`@connectrpc/connect-es`) is the serverless-honest alternative (unary RPC over plain HTTP POST, gRPC-Web compatible), but it has no official SvelteKit/fetch adapter (connect-es#550, open since 2023) — wiring it into `+server.ts` means an unsanctioned DIY bridge over its low-level `UniversalHandler` — and `@grpc/grpc-js` is separately broken on Bun (oven-sh/bun#21759, malformed HTTP/2 trailers). Verdict: none of it gets built here.

If a typed-RPC surface is ever wanted, SvelteKit's native remote functions (`query`/`command`/`form`) are the designated path once they stabilize — zero new dependencies, types flow from TypeScript, no parallel schema to drift.

---

## File Structure

```
src/
├── lib/
│   └── server/
│       ├── api/
│       │   ├── schemas.ts      # Valibot schemas
│       │   ├── validate.ts     # Validation helpers
│       │   ├── response.ts     # Response helpers
│       │   └── ratelimit.ts    # Rate limiting
│       └── graphql/            # Optional GraphQL
│           └── schema.ts       # GraphQL schema + resolvers
├── routes/
│   └── api/
│       ├── health/
│       │   └── +server.ts
│       ├── items/
│       │   ├── +server.ts      # GET (list), POST (create)
│       │   └── [id]/
│       │       └── +server.ts  # GET, PUT, DELETE
│       ├── graphql/            # Optional GraphQL endpoint
│       │   └── +server.ts
│       └── upload/
│           └── +server.ts
└── hooks.server.ts             # CORS, error handling
```

---

## Summary

| What | How |
|------|-----|
| Endpoints | `+server.ts` with HTTP method exports |
| Validation | Valibot schemas + helper functions |
| Errors | `error()` with status codes 4xx/5xx |
| Auth | Check `locals.user` from hooks |
| CORS | `hooks.server.ts` + OPTIONS handler |
| Rate limiting | `createLimiter` factory (Upstash sliding window) |
| Documentation | JSDoc + OpenAPI generator |

---

## Endpoint Inventory (Feature Families)

| Family | Endpoints | Auth |
|--------|-----------|------|
| **Blog posts** | `GET/POST /api/blog/posts`, `PATCH/DELETE /api/blog/posts/[id]`, `POST .../publish`, `GET/POST .../revisions`, `GET/POST .../tags`, `GET/POST .../domain`, `POST .../export`, `POST .../import` | `guardApiBlogAuthor` |
| **Blog assets** | `GET/POST /api/blog/assets`, `PATCH/DELETE /api/blog/assets/[id]`, `POST .../confirm` | `guardApiBlogAuthor` |
| **Blog asset folders** | `GET/POST /api/blog/asset-folders`, `PATCH/DELETE .../[id]` | `guardApiBlogAuthor` |
| **Blog post folders** | `GET/POST /api/blog/post-folders`, `PATCH/DELETE .../[id]` | `guardApiBlogAuthor` |
| **Blog tags** | `GET /api/blog/tags` | `guardApiBlogAuthor` |
| **Blog domains** | `GET /api/blog/domains` | `guardApiBlogAuthor` |
| **Blog preview** | `POST /api/blog/preview` | `guardApiBlogAuthor` |
| **Blog comments** | `GET/POST /api/blog/posts/[id]/comments`, `PATCH/DELETE /api/blog/comments/[id]`, `POST .../hide`, `POST .../unhide`, `POST .../remove` (admin) | GET public; POST session; admin actions `guardApiAdmin` |
| **Grant requests** | `POST/GET/DELETE /api/grant-requests` | session (own) |
| **Admin grant requests** | `GET /api/admin/grant-requests`, `POST .../approve`, `POST .../deny` | `guardApiAdmin` |
| **Admin user grants** | `GET /api/admin/users/[id]/grants`, `PUT/DELETE .../grants/[kind]` | `guardApiAdmin` |

> **Namespace constraint:** `/api/auth/*` is owned by Better Auth's `svelteKitHandler` catch-all. Custom routes under this prefix will 404. Grant-request endpoints are at `/api/grant-requests`, not `/api/auth/grant-requests`.

---

## Input Bounds & Resource Caps

Mutating and long-lived endpoints bound their inputs and connections at the adapter — a valid-shaped but oversized payload is a denial-of-service vector, not just a parse concern.

| Endpoint | Bound |
|----------|-------|
| `PUT /api/desk/spreadsheets/[id]` | Caps cell count, column-meta count, per-cell string length, and total payload size. |
| `POST /api/ai/chatbot` · `/api/ai/deskbot` | Per-surface Valibot schemas (`ChatbotRequestSchema` / `DeskRequestSchema`) cap the lengths of the `toolScopes` and `deskLayout` arrays, and bound the chatbot `pageRouteId` route template (120-char max + strict leading-slash regex — see [ai/site-awareness.md](./ai/site-awareness.md)). |
| `POST /api/ai/proposals/[id]/approve` | Per-user rate-limited. |
| `POST /api/ai/context-probe` | `ContextProbeRequestSchema` bounds `query` to 2000 chars, reuses the strict `pageRouteId` regex, caps `toolScopes` at 5. Retrieval-only (never calls the LLM — worst case one embedding); behind `guardAiRequest`. See [ai/surfaces.md](./ai/surfaces.md#context-assembly--one-door-plus-an-x-ray). |
| `GET /api/analytics/stream` (SSE) | Per-IP connect limit + global concurrent-connection cap + max-duration self-close. A client can't hold a slot forever or open unbounded streams. |

Image processing is bounded in the domain layer, not at the route: `$lib/server/imagemeta/process.ts` calls `sharp(bytes, { limitInputPixels: 25_000_000, failOn: 'truncated' })` — a decompression-bomb guard (a small file that expands to a huge bitmap is rejected) plus rejection of truncated/corrupt input.

> **Removed:** `/api/ai/chat` and `/api/ai/chat/stream` — replaced by the three per-surface routes above, which set an explicit `surface` and share one entry guard (`guardAiRequest`). See [ai/surfaces.md](./ai/surfaces.md).

---

## Related

- [auth.md](./auth.md) - Authentication patterns, capability grants, protected endpoint implementation
- [db/relational.md](./db/relational.md) - Drizzle schema used in API queries
- [db/graph.md](./db/graph.md) - Neo4j for relationship queries
- [pages.md](./pages.md) - `/showcases/cycle/api` route with interactive API explorer

---

## Sources

- [SvelteKit Routing - API Routes](https://svelte.dev/docs/kit/routing#server)
- [SvelteKit Web Standards](https://svelte.dev/docs/kit/web-standards)
- [SvelteKit Errors](https://svelte.dev/docs/kit/errors)
- [SvelteKit Hooks](https://svelte.dev/docs/kit/hooks)
- [Valibot Documentation](https://valibot.dev/)
- [Joy of Code - SvelteKit Endpoints](https://joyofcode.xyz/using-sveltekit-endpoints)
- [Configure CORS in SvelteKit](https://snippets.khromov.se/configure-cors-in-sveltekit-to-access-your-api-routes-from-a-different-host/)
