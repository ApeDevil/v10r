# Security

Security practices for Velociraptor.

---

## Overview

| Concern | Solution | Notes |
|---------|----------|-------|
| Authentication | Better Auth | Session-based, Postgres-backed |
| Input Validation | Valibot + Superforms | Server-side validation |
| Rate Limiting (Forms) | Superforms | Built-in IP/cookie limiter |
| Rate Limiting (Global) | Upstash / sveltekit-rate-limiter | See Rate Limiting section |
| CSRF Protection | SvelteKit | Automatic for form actions (see JSON API note below) |
| XSS Prevention | Svelte | Auto-escapes by default |
| SQL Injection | Drizzle ORM | Parameterized queries |
| Cypher Injection | Neo4j Driver | Parameterized queries (see note below) |

---

## Rate Limiting

### Global Rate Limiting (Required)

> **Critical**: Better Auth's built-in rate limiting is **BROKEN** (GitHub Issue #2153). Always implement external rate limiting.

| Environment | Solution | Package |
|-------------|----------|---------|
| Production | Upstash Redis | `@upstash/ratelimit` |
| Development | In-memory | `sveltekit-rate-limiter` |

**Implementation in `hooks.server.ts`:**

```typescript
import { dev } from '$app/environment';

let rateLimiter: any;

if (dev) {
  const { RateLimiter } = await import('sveltekit-rate-limiter/server');
  rateLimiter = new RateLimiter({ IP: [100, '1m'] });
} else {
  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');
  rateLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
  });
}
```

### Form Rate Limiting (Superforms)

Superforms provides built-in rate limiting for form submissions.

| Strategy | Use Case |
|----------|----------|
| IP-based | General abuse prevention |
| IP + User Agent | Stricter per-device limits |
| Cookie-based | Persistent device tracking |

**Recommended limits:**

| Endpoint Type | Limit |
|---------------|-------|
| Login | 5 attempts / 15 min |
| Registration | 3 attempts / hour |
| Password Reset | 3 attempts / hour |
| Contact Form | 5 submissions / hour |
| API Endpoints | 100 requests / min |
| AI Chat | 20 requests / min (per user) |

---

## Authentication Flow

```
┌──────────┐    ┌─────────────┐    ┌──────────┐
│  Client  │───▶│ Better Auth │───▶│ Postgres │
└──────────┘    └─────────────┘    └──────────┘
                      │
               ┌──────┴──────┐
               │   Session   │
               │  (cookie)   │
               └─────────────┘
```

- Sessions stored in Postgres (not JWT)
- HTTP-only, secure cookies
- Session invalidation on logout
- Optional: session expiry, refresh tokens

### Session Cleanup (Required)

> **Warning**: Better Auth does NOT automatically clean up expired sessions. Without cleanup, the session table will grow indefinitely.

Implement a scheduled cleanup job:

```typescript
// src/lib/server/jobs/session-cleanup.ts
import { db } from '$lib/server/db';
import { session } from '$lib/server/db/schema';
import { lt } from 'drizzle-orm';

export async function cleanupExpiredSessions() {
  const result = await db
    .delete(session)
    .where(lt(session.expiresAt, new Date()));

  console.log(`Cleaned up ${result.rowCount} expired sessions`);
}
```

Run via cron (daily recommended) or Inngest scheduled function.

---

## Security Headers

Recommended headers (set in `hooks.server.ts` or Vercel config):

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer info |
| `Content-Security-Policy` | (project-specific) | XSS protection |

---

## Input Validation

All user input validated server-side with Valibot:

| Layer | Validation |
|-------|------------|
| Forms | Superforms + Valibot schemas |
| API Routes | Valibot in `+server.ts` |
| URL Params | Valibot in `load` functions |

Never trust client-side validation alone.

---

## CSRF Protection for JSON APIs

> **Important**: SvelteKit's automatic CSRF protection only applies to form actions (form-like content types). JSON endpoints (`+server.ts`) require explicit protection.

### The Gap

```
Form actions    →  Protected automatically by SvelteKit
JSON mutations  →  NOT protected — requires manual implementation
```

### Solution: Custom Header Requirement

Require a custom header for JSON mutations. Browsers prevent cross-origin requests from setting custom headers without CORS preflight.

```typescript
// src/hooks.server.ts
const handle: Handle = async ({ event, resolve }) => {
  // Skip for GET, OPTIONS, and form submissions
  if (
    event.request.method === 'GET' ||
    event.request.method === 'OPTIONS' ||
    !event.request.headers.get('content-type')?.includes('application/json')
  ) {
    return resolve(event);
  }

  // Require custom header for JSON mutations
  const csrfHeader = event.request.headers.get('x-requested-with');
  if (csrfHeader !== 'XMLHttpRequest') {
    return new Response('CSRF validation failed', { status: 403 });
  }

  return resolve(event);
};
```

```typescript
// Client-side: Always include the header
fetch('/api/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',  // Required
  },
  body: JSON.stringify({ name: 'New Item' }),
});
```

### Alternative: SvelteKit Origin Check

Configure SvelteKit to check the `Origin` header:

```typescript
// svelte.config.js
export default {
  kit: {
    csrf: {
      checkOrigin: true,  // Enabled by default in SvelteKit 2
    },
  },
};
```

This blocks requests where `Origin` header doesn't match the app's origin. Note: Some proxies strip Origin headers.

---

## Neo4j / Cypher Injection

> **Important**: Cypher (Neo4j's query language) is vulnerable to injection like SQL. Always use parameterized queries.

### Safe Pattern

```typescript
// SAFE: Parameterized values
const result = await session.run(
  'MATCH (u:User {id: $userId}) RETURN u',
  { userId: userInput }
);
```

### Unsafe Pattern

```typescript
// UNSAFE: String interpolation — NEVER DO THIS
const result = await session.run(
  `MATCH (u:User {id: "${userInput}"}) RETURN u`  // Injection risk!
);
```

### Labels Cannot Be Parameterized

Unlike property values, node labels and relationship types cannot be parameterized in Cypher:

```typescript
// This does NOT work — labels are not parameterizable
session.run('MATCH (n:$label)', { label: 'User' });  // Error!

// Workaround: Whitelist allowed labels
const ALLOWED_LABELS = ['User', 'Item', 'Tag'] as const;
type Label = typeof ALLOWED_LABELS[number];

function queryByLabel(label: Label) {
  if (!ALLOWED_LABELS.includes(label)) {
    throw new Error('Invalid label');
  }
  return session.run(`MATCH (n:${label}) RETURN n`);
}
```

---

## Secrets Management

| Environment | Storage |
|-------------|---------|
| Local | `.env` file (gitignored) |
| CI/CD | GitLab CI/CD Variables |
| Production | Vercel Environment Variables |

**Required secrets:**
- `DATABASE_URL` - Neon connection string
- `NEO4J_URI`, `NEO4J_PASSWORD` - Neo4j Aura credentials
- `R2_ACCESS_KEY`, `R2_SECRET_KEY` - Cloudflare R2
- `RESEND_API_KEY` - Email service
- `SENTRY_DSN` - Error tracking
