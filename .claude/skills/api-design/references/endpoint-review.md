# Endpoint Review Checklist

Use this checklist when reviewing existing API endpoints or designing new ones. Organized by priority: correctness first, then operational readiness, then consistency.

## Correctness

- [ ] **Input validation** — All user input validated with Valibot schemas before reaching domain logic
- [ ] **Auth guard present** — `requireApiUser(locals)` or `requireAuth(locals)` called before any data access
- [ ] **Status codes correct** — 201 on create (not 200), 204 on delete, 422 on validation failure (not 400)
- [ ] **Error responses structured** — RFC 9457-aligned `{ error: { code, message, fields? } }`, not raw strings
- [ ] **DTO layer exists** — Response shape defined independently of database schema; no Drizzle `$inferSelect` in responses
- [ ] **Dates serialized** — All `Date` objects converted to ISO strings in the route handler, not the domain layer
- [ ] **Location header on 201** — `POST` that creates a resource returns `Location: /api/v1/resource/:id`

## Operational Readiness

- [ ] **Pagination on collections** — No unbounded `SELECT *`. Cursor pagination for user-facing, offset for admin
- [ ] **Rate limiting aware** — Endpoint is covered by `apiLimiter` or `strictLimiter` as appropriate
- [ ] **Idempotency on mutations** — `POST` endpoints that create records accept `Idempotency-Key` header
- [ ] **N+1 queries prevented** — List endpoints use Drizzle `with` for related data, not sequential queries
- [ ] **Timeout resilience** — Long operations return 202 Accepted with a status polling endpoint, not blocking
- [ ] **Cache headers** — GET endpoints include appropriate `Cache-Control` (even if `no-store`)

## Multi-Client Consistency

- [ ] **Domain function reuse** — Route handler calls a function from `$lib/server/[domain]/`, not inline DB queries
- [ ] **No framework imports in domain** — Domain functions don't import from `@sveltejs/kit` or `$app/`
- [ ] **AI tool compatibility** — If this domain function is exposed as an AI tool, the tool returns the same data shape
- [ ] **Error handling per adapter** — REST returns json error; form action returns `fail()`; AI tool returns error object

## Naming and Convention

- [ ] **Plural nouns for collections** — `/users`, not `/user`
- [ ] **Consistent JSON field casing** — All snake_case (or all camelCase — pick one, enforce globally)
- [ ] **Consistent ID format** — All entity IDs use the same format across endpoints
- [ ] **No verbs in URLs** — Except action endpoints (`/activate`, `/refund`)
- [ ] **Version prefix** — `/api/v1/` on all public endpoints

## Security Surface

- [ ] **No internal IDs leaked** — Error messages don't expose database constraint names or internal entity IDs
- [ ] **CSRF protection** — JSON API mutations require `x-csrf-token` header (or custom CSRF check)
- [ ] **Input size limits** — File uploads, text fields, and arrays have explicit size/length limits
- [ ] **Query parameter injection** — Sort/filter fields validated against an allowlist, not passed to SQL directly

## N+1 Detection

The most common performance issue in REST APIs. Patterns to look for:

```typescript
// N+1 PATTERN — one query per item
const projects = await db.select().from(projects);
for (const project of projects) {
  project.members = await db.select().from(members)
    .where(eq(members.projectId, project.id)); // N queries!
}

// FIXED — eager load with Drizzle relations
const projects = await db.query.projects.findMany({
  with: { members: true }, // Single query with JOIN
});

// ALTERNATIVE — compound endpoint
// GET /projects?include=members
const include = url.searchParams.get('include')?.split(',') ?? [];
const withRelations: Record<string, boolean> = {};
if (include.includes('members')) withRelations.members = true;

const projects = await db.query.projects.findMany({
  with: withRelations,
});
```

## Breaking Change Detection

A change is breaking if any existing client would need to update their code:

| Change | Breaking? |
|--------|-----------|
| Remove a field from response | Yes |
| Rename a field | Yes |
| Change a field's type | Yes |
| Change an error code value | Yes |
| Add a new optional field | No |
| Add a new endpoint | No |
| Add a new optional query parameter | No |
| Change `message` text (human-readable) | No |

Use `oasdiff` in CI to catch breaking changes automatically. See **openapi.md**.
