---
name: api-design
description: API contract design patterns for SvelteKit + Drizzle + Valibot across all surfaces — REST, GraphQL, SSE/streaming, webhooks, and AI tools. Use when designing endpoints, reviewing contracts, choosing pagination, standardizing errors, planning versioning, ensuring multi-client consistency, setting up GraphQL Yoga, designing SSE events, handling inbound webhooks, or structuring AI tool schemas.
---

# API Contract Design

Production patterns for designing, reviewing, and maintaining API contracts across all surfaces in SvelteKit. The same domain functions serve REST endpoints, GraphQL resolvers, AI tool calls, SSE streams, form actions, webhooks, and background jobs — this skill covers the contract layer for each.

## Contents

- [Critical Gotchas](#critical-gotchas) - Must-know issues across all surfaces
- [Surface Selection](#surface-selection) - When to use which API type
- [REST Endpoints](#rest-endpoints) - Resource design, verbs, status codes
- [GraphQL](#graphql) - Yoga v5, schema design, N+1, complexity
- [SSE and Streaming](#sse-and-streaming) - Event contracts, AI SDK protocol
- [Webhooks (Inbound)](#webhooks-inbound) - Signature verification, idempotency
- [AI Tool Contracts](#ai-tool-contracts) - Schema design, permissions, results
- [Shared Patterns](#shared-patterns) - Error responses, pagination, DTO, versioning
- [Multi-Client Consistency](#multi-client-consistency) - Keeping all surfaces aligned
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Deep dives per surface

| Task | Pattern |
|------|---------|
| Design REST endpoint | Resource naming + verb mapping + Valibot schema |
| Add GraphQL surface | Yoga v5 + SDL schema + DataLoader for N+1 |
| Design SSE events | Named events + payload schemas + keepalive |
| Handle inbound webhook | Raw body + HMAC verify + idempotency + async process |
| Design AI tool | `.describe()` on all params + structured result + error return |
| Review any endpoint | Endpoint review checklist (references/endpoint-review.md) |
| Choose pagination | Cursor for user-facing, offset for admin, Relay connections for GraphQL |
| Standardize errors | REST: RFC 9457 envelope / GraphQL: `extensions.code` / AI: return object |
| Detect breaking changes | oasdiff for REST, schema diffing for GraphQL |

## Critical Gotchas

### REST

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| DB models as response | Schema change = breaking API change | Explicit DTO layer (Valibot schema) |
| Offset pagination on large sets | `OFFSET 100000` full scan, duplicates | Cursor pagination with seek method |
| No idempotency on POST | Network retries create duplicates | `Idempotency-Key` header + UNIQUE constraint |
| Generic error messages | Clients can't handle programmatically | RFC 9457 `code` + `message` + `fields` |
| No versioning until too late | Retroactive versioning is painful | `/api/v1/` from first endpoint |
| Missing `Retry-After` on 429 | Thundering herd on resume | IETF rate limit headers on every response |
| Dates serialize as `{}` | `Date` objects become empty in JSON | `.toISOString()` in route layer |

### GraphQL

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| `fetchAPI: globalThis` on Yoga v5 | "Handler should return Response" error | Use `fetchAPI: { Response }` |
| Non-null field on unreliable data | Entire query nulled on one field failure | Default to nullable, add `!` only when guaranteed |
| No DataLoader | N+1: list of 20 items = 21 DB queries | One DataLoader per request in Yoga context |
| No complexity limits | Abusive nested queries crash server | `graphql-armor` plugin (depth=6, cost=5000) |
| `drizzle-graphql` as final API | Exposes full DB shape | Use as scaffold only, build custom schema |
| Introspection in production | Schema leaked to attackers | Disable via `graphql-armor` |

### SSE / Streaming

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| Raw ReadableStream in SvelteKit | File descriptor leaks, streams not closing | Use `sveltekit-sse` library |
| No keepalive ping | Proxies (NGINX, Cloudflare) close idle connections | Send comment `:\n\n` every 25s |
| Vercel Hobby SSE | 10s function timeout (unclear SSE exemption) | Set `maxDuration` or use container deployment |
| AI SDK `AIStream` helpers | Broken in recent SvelteKit versions | Use `streamText().toDataStreamResponse()` |
| Multi-instance SSE | Events only reach one instance | PostgreSQL `LISTEN/NOTIFY` or Redis pub/sub |

### Webhooks

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| `request.json()` before sig verify | Raw bytes lost, signature mismatch | `request.text()` first, parse separately |
| `===` for HMAC comparison | Timing attack vulnerability | `crypto.timingSafeEqual()` |
| Slow webhook handler | Provider retries, duplicate processing | Return 200 immediately, process async |
| No idempotency check | Retried events processed multiple times | `INSERT ON CONFLICT DO NOTHING` with event_id |

### AI Tools

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| No `.describe()` on Zod fields | LLM guesses parameter intent, wrong values | Describe every field, include examples |
| Throwing from `execute()` | AI turn crashes entirely | Return `{ error: "..." }`, never throw |
| Generic param names (`data`, `input`) | LLM confused about what to pass | Domain-specific names (`search_query`, `item_id`) |
| `maxSteps` not set | Runaway tool loops or zero tool calls | Set explicitly (`maxSteps: 5`) |
| Auth inside tool execute | Re-authenticates per tool call | Auth at endpoint, pass userId via closure |

## Surface Selection

| Use Case | Surface | Why |
|----------|---------|-----|
| Standard CRUD | REST `+server.ts` | Simplest, cacheable, well-understood |
| Flexible field selection (mobile + web) | GraphQL | One query, client picks fields |
| Real-time updates (notifications) | SSE | Server-push, auto-reconnect |
| AI chat completion | Vercel AI SDK streaming | Data stream protocol, tool multiplexing |
| External service callbacks | Webhook endpoint | HMAC-verified, idempotent |
| AI agent capability | AI tool definition | Zod schema + structured result |
| Form submissions | SvelteKit form actions | Progressive enhancement, built-in CSRF |
| Scheduled/reactive processing | Background job / Inngest | No HTTP surface, trusted context |

**Default to REST.** Add other surfaces only when they solve a specific problem REST doesn't.

## REST Endpoints

### Resource Design

```
/api/v1/users                    # Collection (plural noun)
/api/v1/users/:id                # Singleton
/api/v1/users/:id/notifications  # Sub-resource (max 2 levels deep)
/api/v1/users/:id/activate       # Action (when PATCH feels awkward)
```

### HTTP Verb Mapping

| Verb | Semantics | Idempotent | Response |
|------|-----------|------------|----------|
| GET | Read | Yes | 200 + data |
| POST | Create | No (needs idempotency key) | 201 + data + `Location` header |
| PUT | Full replace | Yes | 200 + data |
| PATCH | Partial update | Yes | 200 + data |
| DELETE | Remove | Yes | 204 (no body) |

### Thin Route Handler Pattern

```typescript
// src/routes/api/v1/items/+server.ts
export const GET: RequestHandler = async ({ url, locals }) => {
  const { user } = requireApiUser(locals);        // Auth
  const params = validateQuery(url, PaginationSchema); // Validate
  const result = await getItems(user.id, params);  // Domain call
  return json(result);                             // Serialize
};
```

Route handler = adapter: auth, validate, call domain, serialize, return. No business logic.

## GraphQL

### Yoga v5 + SvelteKit Setup

```typescript
// src/lib/server/graphql/yoga.ts
import { createSchema, createYoga } from 'graphql-yoga';
import type { RequestEvent } from '@sveltejs/kit';

export const yoga = createYoga<RequestEvent>({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },  // v5: explicit Response, NOT globalThis
  graphiql: process.env.NODE_ENV !== 'production',
});

// src/routes/api/graphql/+server.ts
export const GET: RequestHandler = (event) => yoga.handleRequest(event.request, event);
export const POST: RequestHandler = (event) => yoga.handleRequest(event.request, event);
```

### Key Decisions

- **Schema-first (SDL)**: Keep `typeDefs` as readable SDL string, not code-generated
- **Nullability**: Default to nullable output fields, non-null for inputs. Non-null fields bubble errors up to nearest nullable parent
- **Pagination**: Relay Connection spec for lists (`edges`, `pageInfo`, `cursor`)
- **Errors**: `extensions.code` for machine-readable codes (maps to REST `error.code`)
- **Security**: `graphql-armor` plugin — depth=6, costLimit=5000, disable introspection in prod

### N+1 Prevention with DataLoader

```typescript
// One DataLoader per request — never shared across requests
context: (event) => ({
  ...event,
  loaders: {
    tagsByItemId: new DataLoader<string, Tag[]>(async (ids) => {
      const rows = await db.query.itemTags.findMany({
        where: inArray(itemTags.itemId, [...ids]),
        with: { tag: true },
      });
      const byId = new Map<string, Tag[]>();
      for (const row of rows) {
        const list = byId.get(row.itemId) ?? [];
        list.push(row.tag);
        byId.set(row.itemId, list);
      }
      return ids.map(id => byId.get(id) ?? []);
    }),
  },
}),
```

See **references/graphql.md** for full setup, Relay connections, error handling patterns.

## SSE and Streaming

### SSE Event Design

```typescript
// Named events with typed payloads
ctrl.enqueue(encoder.encode(
  `event: notification\nid: ${id}\ndata: ${JSON.stringify(payload)}\n\n`
));

// Keepalive comment (prevents proxy timeout)
ctrl.enqueue(encoder.encode(`:\n\n`));

// Client uses typed listeners
source.addEventListener('notification', (e) => { /* e.data */ });
source.addEventListener('session-expired', () => { /* logout */ });
```

### Contract Requirements

Every streaming endpoint must define:
1. **Wire format** — SSE text lines or AI SDK Data Stream Protocol
2. **Named event types** — Each with payload schema
3. **Reconnection** — `retry:` hint + `Last-Event-ID` support
4. **Auth failure during stream** — Send `event: auth-error`, then close
5. **Terminal event** — For finite streams, send `event: done` then close

### Vercel AI SDK Streaming

```typescript
// The one pattern that works reliably
const result = streamText({ model, messages, tools, maxSteps: 5 });
return result.toDataStreamResponse(); // NOT legacy AIStream helpers
```

See **references/streaming.md** for AI SDK protocol details, serverless limits, documentation approach.

## Webhooks (Inbound)

### The Pattern

```typescript
// src/routes/api/webhooks/stripe/+server.ts
export const POST: RequestHandler = async ({ request }) => {
  // 1. Read raw body FIRST (before any parsing)
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  // 2. Verify signature (constant-time comparison)
  if (!verifySignature(rawBody, sig, WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // 3. Idempotency check (INSERT ON CONFLICT DO NOTHING)
  const isNew = await recordWebhookEvent(event.id, 'stripe', event.type);
  if (!isNew) return new Response(null, { status: 200 }); // Already processed

  // 4. Return 200 IMMEDIATELY, process async
  processWebhookAsync(event).catch(console.error);
  return new Response(null, { status: 200 });
};
```

### Webhook vs Regular Endpoint

| Aspect | Regular API | Webhook |
|--------|-------------|---------|
| Auth | Session/API key | HMAC signature |
| Body | `request.json()` | `request.text()` first |
| Response | After processing | Before processing (return 200 fast) |
| Idempotency | Optional | Required (providers retry) |
| Error response | 4xx with details | 200 even on failure (suppress retries) |

See **references/webhooks.md** for HMAC verification code, Inngest integration, database schema.

## AI Tool Contracts

### LLM-Friendly Schema Design

```typescript
const searchItems = tool({
  description: 'Search items by name or tag. Returns paginated results.',
  inputSchema: z.object({
    query: z.string().describe('Search text. Example: "invoices from last month"'),
    limit: z.number().min(1).max(50).default(10)
      .describe('Max results to return. Default 10.'),
    status: z.enum(['active', 'archived']).nullable()
      .describe('Filter by status. Null for all statuses.'),
  }),
  execute: async ({ query, limit, status }) => {
    try {
      const results = await searchItemsDomain(userId, query, limit, status);
      return { items: results.map(toItemSummary), total: results.length };
    } catch {
      return { error: 'Search failed. Try again.' };
    }
  },
});
```

### Rules

- **`.describe()` on every parameter** — LLMs read JSON Schema descriptions, not variable names
- **Prefer enums over booleans** — `mode: 'read' | 'write'` beats `readOnly: boolean`
- **Flat parameter objects** — Avoid nesting; use name prefixes if grouping needed
- **Nullable over optional** — `z.nullable()` forces LLM to explicitly set null vs silently omit
- **Structured results, not prose** — LLM summarizes data; pre-formatted text = double formatting
- **Never throw from execute** — Return `{ error: "..." }` objects
- **Auth via closure** — `createTools(userId)`, never re-auth inside execute

### Permission Scoping

```typescript
export function createTools(userId: string) {
  return {
    // Read — safe for all contexts
    ...readTools(userId),
    // Write — only for authenticated sessions with write scope
    ...(hasWriteAccess ? writeTools(userId) : {}),
    // Destructive — NEVER in automated agents
  };
}
```

See **references/ai-tools.md** for schema evolution, tool vs REST differences, prompt injection defense.

## Shared Patterns

### Error Responses Across Surfaces

| Surface | Error Pattern |
|---------|---------------|
| REST | `{ error: { code, message, fields? } }` with HTTP status |
| GraphQL | `errors[].extensions.code` + `message` (spec-compliant) |
| AI tool | `return { error: "Human-readable message" }` (never throw) |
| Form action | `fail(status, { form, error })` via Superforms |
| Webhook | Return 200 regardless; log failures internally |

The `code` field is the machine-readable contract in REST and GraphQL. Changing it is a breaking change.

### Pagination Across Surfaces

| Surface | Pattern |
|---------|---------|
| REST | Cursor pagination with `?cursor=eyJ...&limit=20` |
| GraphQL | Relay Connection spec (`first`, `after`, `edges`, `pageInfo`) |
| AI tool | Return `{ items, has_more, next_cursor }` as structured data |

The same `encodeCursor` / `decodeCursor` helpers work for both REST and GraphQL.

### DTO Layer

Never expose Drizzle `$inferSelect` types directly on any surface. Define explicit response shapes:

```typescript
// Valibot schema = the API contract (DTO)
const UserResponse = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  created_at: v.string(),
});
```

**Key question for any surface:** Does the response shape serve the caller, or mirror the database?

### Versioning

- **REST**: URL path `/api/v1/`. Bump on breaking changes only.
- **GraphQL**: Schema evolution (add fields, deprecate old). Use `@deprecated` directive.
- **AI tools**: Additive changes safe. Breaking changes = new tool name (`searchItemsV2`).
- **SSE**: Add new event types freely. Renaming/removing events is breaking.

## Multi-Client Consistency

```
+server.ts (REST)      → domain function → JSON response
+page.server.ts (UI)   → domain function → serialized data
GraphQL resolver       → domain function → typed result
AI tool execute()      → domain function → structured data
Webhook handler        → domain function → async processing
Background job         → domain function → direct call
```

### Checklist

- Same domain function for all clients (no logic duplication)
- Domain functions in `$lib/server/[domain]/` with no SvelteKit imports
- Date serialization happens in the adapter layer, not the domain
- Error handling differs by adapter but uses same error classifiers
- Auth happens once per adapter surface
- Response shape may differ, but underlying data is identical

## Anti-Patterns

**Don't expose DB models on any surface:**
```typescript
// WRONG — REST, GraphQL, or AI tool returning raw DB rows
return json(await db.select().from(users));

// RIGHT — explicit DTO shape
return json({ data: users.map(toUserResponse) });
```

**Don't use `request.json()` for webhooks:**
```typescript
// WRONG — raw bytes lost, signature will fail
const body = await request.json();

// RIGHT — preserve raw body
const rawBody = await request.text();
const body = JSON.parse(rawBody);
```

**Don't throw from AI tool execute:**
```typescript
// WRONG — crashes the AI turn
execute: async () => { throw new Error('Not found'); }

// RIGHT — LLM reads the error and communicates it
execute: async () => { return { error: 'Item not found.' }; }
```

**Don't skip descriptions on tool params:**
```typescript
// WRONG — LLM guesses from "q" and "n"
inputSchema: z.object({ q: z.string(), n: z.number() })

// RIGHT — LLM has clear guidance
inputSchema: z.object({
  query: z.string().describe('Search text'),
  limit: z.number().describe('Max results (default 10)'),
})
```

**Don't use `globalThis` with Yoga v5:**
```typescript
// WRONG — broken since Yoga 1.27.1+
createYoga({ fetchAPI: globalThis })

// RIGHT — explicit Response for v5+
createYoga({ fetchAPI: { Response } })
```

## References

### REST
- **references/error-responses.md** — RFC 9457 structure, Valibot schemas, error classifiers
- **references/pagination.md** — Cursor with Drizzle, composite key seek, offset fallback
- **references/endpoint-review.md** — Full review checklist, N+1 detection, breaking changes
- **references/openapi.md** — Spectral linting, oasdiff, sveltekit-valibot-openapi

### Beyond REST
- **references/graphql.md** — Yoga v5 setup, nullability, Relay connections, DataLoader, graphql-armor
- **references/streaming.md** — SSE contracts, AI SDK protocol, serverless limits, documentation
- **references/webhooks.md** — HMAC verification, idempotency schema, Inngest integration
- **references/ai-tools.md** — Schema design, permissions, result format, evolution, prompt injection
