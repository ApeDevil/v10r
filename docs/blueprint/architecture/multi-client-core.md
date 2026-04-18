# Multi-Client Core Architecture

The same backend logic must serve five client types: human UI (SvelteKit form actions and load functions), AI agents (Vercel AI SDK tool calls), external API (REST endpoints), background jobs, and reactive workflows (Inngest). The naive path is duplication — a form action, an API endpoint, and a tool each re-implementing the same operation. This document formalizes the pattern already in the codebase to prevent that.

The answer is not a new architecture layer. Domain modules in `$lib/server/[domain]/` already are the operations layer. The job is to name that clearly, add AI tool definitions as thin wrappers, and enforce four invariants everywhere.

> For the full background jobs architecture (scheduled, reactive, manual), see [jobs.md](./jobs.md).

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                          ADAPTERS                            │
│                                                              │
│  +page.server.ts   +server.ts   AI tools   jobs/  inngest/  │
│  (form actions,    (REST API,   (tool       (cron, (reactive │
│   load fns)         SSE)        wrappers)   sched.) events)  │
└──────┬───────────────┬───────────┬──────────┬────────┬───────┘
       │               │           │          │        │
       ▼               ▼           ▼          ▼        ▼
┌──────────────────────────────────────────────────────────────┐
│                      DOMAIN MODULES                          │
│                 $lib/server/[domain]/                         │
│                                                              │
│  notifications/    auth/         rawrag/      llmwiki/        │
│  ├── index.ts      ├── index.ts  ├── index.ts ├── search.ts  │
│  ├── service.ts    └── guards.ts └── ...      └── ...        │
│  └── ...                                                     │
│                                                              │
│  db/[domain]/                                                │
│  ├── queries.ts   (reads — no side effects)                  │
│  └── mutations.ts (writes — explicit intent)                 │
└──────────────────────────┬───────────────┬───────────────────┘
                           │               │
                           ▼               ▼
┌──────────────────────┐  ┌────────────────────────────────────┐
│  PostgreSQL           │  │  Neo4j  │  Redis  │  R2            │
│  (Drizzle ORM)       │  │  (graph)│ (cache) │  (storage)     │
└──────────────────────┘  └────────────────────────────────────┘
```

**How each client flows through:**

| Client | Adapter | Domain call | Infrastructure |
|--------|---------|-------------|----------------|
| Human UI | `+page.server.ts` load/action | `getNotifications()` | PostgreSQL |
| REST API | `+server.ts` GET/POST | `markAsRead()` | PostgreSQL |
| AI tool | `createNotificationTools()` execute | `getNotifications()` | PostgreSQL |
| Background job | `notificationCleanup()` | direct DB call | PostgreSQL |
| Reactive workflow | Inngest `step.run()` | `NotificationService.send()` | PostgreSQL |

---

## Directory Structure

This is the actual layout — not a new proposal, but naming what already exists:

```
src/lib/server/
  notifications/               ← domain module
    index.ts                   ← barrel export (public API)
    service.ts                 ← multi-step orchestration
    stream.ts                  ← SSE connection registry
    router.ts                  ← external channel routing
    outbox.ts                  ← delivery scheduling
  db/notifications/            ← data access
    queries.ts                 ← reads
    mutations.ts               ← writes
  auth/
    guards.ts                  ← requireAuth(), requireApiUser(), requireAdmin()
    index.ts                   ← Better Auth instance
  rawrag/
    index.ts                   ← retrieve(), formatContextForPrompt()
    chunk.ts / embed.ts        ← chunking + embedding pipeline
    ingest/                    ← ingestion pipeline
  llmwiki/
    search.ts                  ← hybrid vector+BM25 wiki search
    queries.ts                 ← hydratePointers
    verify.ts                  ← citation verification
    overview.ts / wiki-format.ts / compile/ / lint/
  ai/
    index.ts                   ← provider registry + active model
    errors.ts                  ← classifyAIError(), AIError
    config.ts                  ← prompts, limits, rate limit config
    tools/                     ← AI tool definitions (add as needed)
      notifications.ts         ← tool wrappers for notification domain
      index.ts                 ← tool registry
  api/
    rate-limit.ts              ← createLimiter(), rateLimitResponse()
  jobs/
    runner.ts                  ← runJob() — execute + log
    scheduler.ts               ← cron-aware job scheduler
    index.ts                   ← job registry (schedules + metadata)
  inngest/
    client.ts                  ← Inngest client instance
    functions/                 ← reactive job definitions
    index.ts                   ← barrel export
  errors/
    index.ts                   ← ServerError base class
```

The `service.ts` layer exists only when orchestration spans multiple infrastructure calls. `NotificationService.send()` justifies it: it calls DB, then SSE, then async external routing. A single DB query does not need a service wrapper.

---

## The Four Invariants

All code in `$lib/server/[domain]/` must follow these. Violations break cross-client reuse.

**1. No framework imports in domain modules.**

Domain functions must not import from `@sveltejs/kit` or `$app/`. Those imports bind logic to the SvelteKit request cycle and prevent reuse by tools and jobs.

```typescript
// WRONG — domain module importing framework
import { error } from '@sveltejs/kit';
export async function getNotification(id: string, userId: string) {
  const row = await db.select()...;
  if (!row) error(404, 'Not found'); // breaks AI tools and jobs
}

// CORRECT — domain function returning null
export async function getNotificationById(id: string, userId: string) {
  const [row] = await db.select()...where(and(eq(notifications.id, id), eq(notifications.userId, userId))).limit(1);
  return row ?? null;
}
```

**2. Date serialization happens in the route layer.**

`Date` objects serialize as `{}` in JSON. The route layer converts them. Domain modules return `Date` objects as-is.

```typescript
// src/routes/app/notifications/+page.server.ts
return {
  notifications: notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),   // ← route layer responsibility
    readAt: n.readAt?.toISOString() ?? null,
  })),
};
```

**3. SvelteKit response helpers belong in the adapter layer.**

`redirect()`, `error()`, `fail()`, `message()`, `setError()` — all route-layer only.

```typescript
// src/lib/server/auth/guards.ts — route-facing, fine here
export function requireApiUser(locals: App.Locals) {
  if (!locals.user || !locals.session) {
    error(401, 'Authentication required'); // SvelteKit error() — adapter layer
  }
  return { user: locals.user, session: locals.session };
}
```

**4. Domain modules call down, not across.**

A domain module calls its own DB queries and infrastructure. To use another domain's data, import from its barrel export (`index.ts`). Never reach into another domain's internal files.

```typescript
// CORRECT — using barrel export
import { NotificationService } from '$lib/server/notifications'; // index.ts barrel

// WRONG — reaching into internals
import { createNotification } from '$lib/server/notifications/service'; // private
```

---

## Client Adapter Patterns

### Human UI — form actions and load functions

The load function extracts from `event.locals`, calls domain functions, serializes dates, returns data.

```typescript
// src/routes/app/notifications/+page.server.ts
export const load: PageServerLoad = async ({ locals, url }) => {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const offset = (page - 1) * NOTIFICATIONS_PAGE_SIZE;

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(locals.user!.id, NOTIFICATIONS_PAGE_SIZE, offset),
    getUnreadCount(locals.user!.id),
  ]);

  return {
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(), // date serialization — route's job
      readAt: n.readAt?.toISOString() ?? null,
    })),
    unreadCount,
    page,
  };
};
```

Form actions call domain mutations directly, return `fail()` on error, return data on success. Superforms lifecycle (`superValidate`, `message`, `setError`) stays in the action — it never goes in a domain module.

### REST API

`+server.ts` calls the same domain functions. Guards, rate limiting, and JSON shaping are adapter concerns.

```typescript
// src/routes/api/notifications/[id]/read/+server.ts
export const POST: RequestHandler = async ({ params, locals }) => {
  const { user } = requireApiUser(locals);  // 401 on fail, not redirect

  try {
    const found = await markAsRead(params.id, user.id);
    if (!found) return json({ error: 'Notification not found' }, { status: 404 });
    return json({ success: true });
  } catch (err) {
    const dbErr = classifyDbError(err);
    return json({ error: dbErr.message }, { status: dbErr.toStatus() });
  }
};
```

Note: the same `markAsRead()` function serves both this REST endpoint and any future AI tool.

### AI Tools

A tool is a thin wrapper: Zod schema describing parameters, description for the LLM, and an `execute` callback that calls the existing domain function.

```typescript
// src/lib/server/ai/tools/notifications.ts
import { tool } from 'ai';
import { z } from 'zod';
import { getNotifications, getUnreadCount } from '$lib/server/db/notifications/queries';
import { markAsRead, markAllAsRead } from '$lib/server/db/notifications/mutations';
import { NOTIFICATIONS_PAGE_SIZE } from '$lib/server/config';

export function createNotificationTools(userId: string) {
  return {
    listNotifications: tool({
      description: 'List the user\'s notifications with unread count. Returns paginated results.',
      parameters: z.object({
        page: z.number().int().min(1).optional().describe('Page number, 1-indexed'),
      }),
      execute: async ({ page = 1 }) => {
        try {
          const offset = (page - 1) * NOTIFICATIONS_PAGE_SIZE;
          const [notifications, unreadCount] = await Promise.all([
            getNotifications(userId, NOTIFICATIONS_PAGE_SIZE, offset),
            getUnreadCount(userId),
          ]);
          return {
            notifications: notifications.map((n) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              body: n.body,
              isRead: n.isRead,
              createdAt: n.createdAt.toISOString(),
            })),
            unreadCount,
            page,
          };
        } catch (err) {
          // Tools RETURN errors — never throw. The LLM must read the error.
          return { error: 'Failed to fetch notifications. Try again.' };
        }
      },
    }),

    markNotificationRead: tool({
      description: 'Mark a specific notification as read.',
      parameters: z.object({
        notificationId: z.string().uuid().describe('ID of the notification to mark read'),
      }),
      execute: async ({ notificationId }) => {
        try {
          const found = await markAsRead(notificationId, userId);
          if (!found) return { error: 'Notification not found.' };
          return { success: true };
        } catch {
          return { error: 'Failed to mark notification as read.' };
        }
      },
    }),
  };
}
```

Key points:
- `createNotificationTools(userId)` factory captures auth via closure. No auth headers, no session lookup inside the tool.
- Tools return error objects, not throw. The LLM reads the error and communicates it to the user.
- Date serialization happens inside the tool's `execute`, same as a load function.

**Tool registry** in `$lib/server/ai/tools/index.ts`:

```typescript
// src/lib/server/ai/tools/index.ts
import { createNotificationTools } from './notifications';

export function createTools(userId: string) {
  return {
    ...createNotificationTools(userId),
    // ...createOtherTools(userId),
  };
}
```

Wire into the chat endpoint:

```typescript
// src/routes/api/ai/chat/+server.ts (addition)
import { createTools } from '$lib/server/ai/tools';

const result = streamText({
  model: chatModel,
  system: SYSTEM_PROMPT,
  messages,
  maxTokens: MAX_TOKENS,
  tools: createTools(user.id),
  maxSteps: 5, // set explicitly — prevent runaway loops
});
```

### Background Jobs

Jobs call domain functions directly. No auth context needed — jobs run in a trusted server context.

```typescript
// src/lib/server/jobs/notification-cleanup.ts
export async function notificationCleanup(): Promise<number> {
  // Direct DB calls — no guards, no auth
  const deleted = await db.delete(notifications).where(
    and(isNotNull(notifications.archivedAt), lt(notifications.archivedAt, deleteCutoff)),
  ).returning({ id: notifications.id });

  return deleted.length;
}
```

When a job sends notifications on behalf of a user, pass an explicit identity string for audit logs:

```typescript
await NotificationService.send({
  userId: targetUserId,
  actorId: 'system:scheduler', // system identity for audit trail
  type: 'system',
  title: 'Your weekly digest',
});
```

Jobs register in `src/lib/server/jobs/index.ts`. They're triggered two ways: `scheduler.ts` via `setInterval` (persistent containers), and `src/routes/api/cron/[job]/+server.ts` via HTTP (Vercel cron). Same `runJob()` function handles both — the adapter varies, the job does not.

---

## Authentication Per Client Type

| Client | Mechanism | Guard | Failure behavior |
|--------|-----------|-------|-----------------|
| Human UI page | Session cookie → Better Auth | `requireAuth(locals)` | `redirect(303, '/auth/login')` |
| REST API endpoint | Session cookie → Better Auth | `requireApiUser(locals)` | `error(401)` |
| AI tool | Inherited from chat endpoint | closure capture of `userId` | N/A — tool never sees unauthenticated call |
| External API (future) | API key header | `requireApiKey(request)` | `error(401)` |
| Background job | None — trusted context | none | N/A |
| Reactive workflow | Inngest signing key | Verified by `serve()` SDK | N/A — Inngest handles auth |

The AI tool pattern is important: authentication happens once, at the `POST /api/ai/chat` endpoint. `requireApiUser` runs there. The tool factory receives the verified `user.id` as a closure argument. No tool ever calls `requireApiUser` itself.

```typescript
// src/routes/api/ai/chat/+server.ts
export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = requireApiUser(locals);  // auth happens here, once

  // ...

  const result = streamText({
    model: chatModel,
    messages,
    tools: createTools(user.id),  // userId flows into tool closures
    maxSteps: 5,
  });
};
```

---

## Error Handling Across Surfaces

Domain functions throw `ServerError` subclasses or return `null`/`boolean`. They never throw raw DB errors or strings.

```
Domain layer:   throws ServerError subclasses (DbError, AIError, Neo4jError)
                or returns null / false on not-found / no-op

Route layer:    catches and translates:
                  form actions  → fail() + form error messages
                  API endpoints → json({ error }, { status: err.toStatus() })
                  page loads    → error() for hard failures

AI tools:       catch and RETURN structured error object — never throw
```

**Error classifier pattern** — used at every domain boundary:

```typescript
// DB errors → DbError
import { classifyDbError } from '$lib/server/db/errors';
const dbErr = classifyDbError(err);
return json({ error: dbErr.message }, { status: dbErr.toStatus() });

// AI provider errors → AIError
import { classifyAIError } from '$lib/server/ai/errors';
const aiErr = classifyAIError(err);
return json({ error: aiErr.message }, { status: aiErrorToStatus(aiErr.kind) });

// Neo4j errors → Neo4jError
import { classifyNeo4jError } from '$lib/server/graph/errors';
const graphErr = classifyNeo4jError(err);
```

**Safe messages only.** Never expose raw PostgreSQL constraint names (`23505`), provider API key prefixes, or internal error codes in responses. The `classifyDbError` and `classifyAIError` functions normalize these to safe messages before they reach the adapter layer.

**AI tool error contract:**

```typescript
execute: async ({ notificationId }) => {
  try {
    const found = await markAsRead(notificationId, userId);
    if (!found) return { error: 'Notification not found.' };
    return { success: true };
  } catch {
    // Generic message — the LLM will rephrase this for the user anyway
    return { error: 'Failed to mark notification as read.' };
  }
},
```

Do not include DB constraint names or internal identifiers in tool error returns. The LLM may rephrase and leak them.

---

## AI Tool Integration Details

### Tool permission manifest

AI tools get a narrower permission set than human UI. Define this explicitly and fail-closed: if a tool is not in the manifest, the AI cannot call it.

```typescript
// src/lib/server/ai/tools/index.ts
export function createTools(userId: string) {
  return {
    // READ operations
    listNotifications: ...,
    getUnreadCount: ...,

    // LIMITED WRITES — carefully scoped
    markNotificationRead: ...,
    markAllNotificationsRead: ...,

    // NOT INCLUDED — too destructive for AI invocation
    // deleteAccount: ...
    // updateEmail: ...
    // exportUserData: ...
  };
}
```

The chat endpoint controls `maxSteps`. Set it explicitly — omitting it uses a library default that may be 0 (no tool calls) or unlimited:

```typescript
streamText({
  model: chatModel,
  messages,
  tools: createTools(user.id),
  maxSteps: 5, // prevent runaway tool loops
});
```

### Tool result format

Return structured data the LLM can summarize, not pre-formatted prose:

```typescript
// GOOD — structured, LLM summarizes
return { notifications: [...], unreadCount: 3 };

// BAD — pre-formatted prose (brittle, hard to act on programmatically)
return { message: 'You have 3 unread notifications: mention from Alice...' };
```

---

## Security Considerations

**Tool authorization scope.** Human UI can delete accounts, export data, manage billing. AI tools cannot. The permission manifest (above) enforces this. Fail-closed: unrecognized tool calls fail, never succeed.

**Prompt injection via tool results.** Attacker-controlled content (notification titles, user-generated text) flows from DB through tool results back into the LLM context. Wrap untrusted content in delimiters:

```typescript
execute: async ({ page }) => {
  const notifications = await getNotifications(userId, ...);
  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      // Wrap user-generated fields
      title: `[NOTIFICATION_TITLE]${n.title}[/NOTIFICATION_TITLE]`,
      body: n.body ? `[NOTIFICATION_BODY]${n.body}[/NOTIFICATION_BODY]` : null,
    })),
  };
};
```

**Rate limit amplification.** One chat request can trigger `maxSteps` tool calls. Each tool call may hit the DB. Rate limit at the chat endpoint level (per user, per minute), not per tool call. `src/lib/server/api/rate-limit.ts` handles this: `createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)`.

**Session revocation mid-stream.** Tool calls inherit auth from the initial request. If a session is revoked after the stream starts, tools continue executing until the stream ends. Better Auth's `cookieCache` (5-minute window) is the tradeoff — it reduces DB lookups but delays revocation propagation. Acceptable for this project; document it explicitly.

**Error information leakage.** LLMs rephrase error messages. If a tool returns `"Unique constraint violation on email column"`, the LLM may restate it in ways that leak schema details. Always return user-safe messages from tools.

---

## Cross-Domain Boundaries

When domain modules need data from another domain:

- **One read hop is acceptable.** Import from the other domain's barrel export (`index.ts`).
- **Writes stay in the owning domain.** Never mutate another domain's data directly.
- **Complex workflows belong in the consumer.** If notifications need user data, the notification module queries it — not the other way around.
- **No circular imports.** If A imports from B and B imports from A, extract the shared type to a third module.

```typescript
// src/lib/server/notifications/service.ts
// CORRECT — querying user data for delivery, one read hop
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth/_better-auth';

const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
```

The notification service owns the delivery workflow. It reads the user email it needs. It does not call into an `auth` domain function to get it — that would create a cross-domain dependency on auth internals.

---

## Extraction Rules

**Do not extract** when the operation is "call one data function and return result." That stays in the route. No wrapping needed.

**Extract to a domain service** when two concrete consumers (not hypothetical ones) need the same multi-step workflow.

`NotificationService.send()` is the model. It has four concrete consumers:
1. Routes triggering notifications from user actions
2. Background jobs sending digests
3. SSE pushing real-time events
4. External channel routing (Telegram, Discord, email)

Extracting was justified because the same three-step sequence (DB insert → SSE push → async channel routing) would otherwise be duplicated.

**Build the first AI tool. Then see what needs sharing.** Don't extract speculatively — simple routes calling DB functions directly are already correct. The notification tool example above calls `getNotifications` and `markAsRead` directly without any service layer. That is correct. The service layer only appears when orchestration exists.

---

## Migration Path

1. **Start with notifications.** The domain is already multi-consumer: UI, SSE, background cleanup, external channels. Adding AI tools is one more adapter.
2. **Create `$lib/server/ai/tools/`** with `notifications.ts` and an `index.ts` registry.
3. **Wire into the chat endpoint** via `createTools(user.id)` and `maxSteps: 5`.
4. **Leave simple CRUD routes as-is.** A `+page.server.ts` that calls one query function is already correct. No wrapping needed.
5. **Extract into `service.ts` only** when the second concrete consumer appears with the same multi-step need.

---

## What We Chose Not To Do

| Option | Why not |
|--------|---------|
| `$lib/server/operations/` directory | Domain colocation is better. Operations are inside their domain, not extracted to a parallel tree. |
| `op` prefix on functions | `NotificationService.send()` is already unambiguous. Prefixes add noise without clarity. |
| Class-based DI containers | 50–200ms cold start penalty on serverless per container initialization. Plain module imports are zero-cost. |
| CQRS infrastructure | Use the vocabulary (queries vs. mutations as directory names) but skip the infrastructure — no command buses, no event sourcing. |
| Formal interfaces for single implementations | Hexagonal architecture ceremony without benefit. TypeScript structural typing gives interface-like guarantees without explicit `interface INotificationService`. |
| LangChain / LangGraph | Practitioners consistently remove these after initial enthusiasm. Plain `streamText` with `tools` is readable, debuggable, and sufficient. The `vercel-labs/github-tools` reference implementation uses plain functions. |

---

## References

| Source | Relevance |
|--------|-----------|
| Cockburn — Hexagonal Architecture (2005, updated 2023) | Original ports-and-adapters framing. Domain modules = hexagon core. Adapters = ports. |
| AWS Prescriptive Guidance — Hexagonal for Serverless | Validates the pattern on cold-start-sensitive infrastructure. Prefers modules over DI containers. |
| Heikkilä — Clean Frontend Architecture with SvelteKit | Concrete application of hexagonal to SvelteKit route structure. |
| Vercel AI SDK — `tool()`, `streamText`, `maxSteps` | Tool definition contract, stream management, step limits. |
| `vercel-labs/github-tools` | Canonical example: tool wraps service function, auth via closure, returns structured data. |
| Auth0 for AI Agents | Production auth patterns for tool-calling agents. Closure capture over per-call auth checks. |
| Fowler — Function Calling with LLMs | Tool result format guidance. Structured data over pre-formatted prose. |
