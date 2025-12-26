# Middleware

SvelteKit hooks for request interception, authentication, and cross-cutting concerns.

## Overview

| Hook | Purpose | File |
|------|---------|------|
| `handle` | Intercept every request | `hooks.server.ts` |
| `handleFetch` | Intercept server-side fetches | `hooks.server.ts` |
| `handleError` | Global error handler | `hooks.server.ts` |
| `reroute` | URL rewriting | `hooks.ts` |

---

## Handle Hook

The `handle` hook intercepts every request before it reaches routes.

### Basic Structure

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Before route handler
  console.log(`${event.request.method} ${event.url.pathname}`);

  // Call the route
  const response = await resolve(event);

  // After route handler
  return response;
};
```

### Setting Request Context

Use `event.locals` to pass data through the request lifecycle:

```typescript
// src/hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  // Set request ID for tracing
  event.locals.requestId = crypto.randomUUID();

  // Set timestamp
  event.locals.requestTime = Date.now();

  return resolve(event);
};
```

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      requestId: string;
      requestTime: number;
      user: User | null;
    }
  }
}
```

---

## Composing Multiple Handlers

Use `sequence()` to chain multiple handlers. **Order matters.**

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Check rate limit first (before expensive auth checks)
  const ip = event.getClientAddress();
  if (isRateLimited(ip)) {
    return new Response('Too Many Requests', { status: 429 });
  }
  return resolve(event);
};

const i18nHandle: Handle = async ({ event, resolve }) => {
  // Detect locale from URL or Accept-Language
  const locale = detectLocale(event);
  event.locals.locale = locale;
  return resolve(event);
};

const authHandle: Handle = async ({ event, resolve }) => {
  // Verify session, set user
  const session = await getSession(event);
  event.locals.user = session?.user ?? null;
  return resolve(event);
};

// Order: rate limit → i18n → auth
export const handle = sequence(
  rateLimitHandle,
  i18nHandle,
  authHandle
);
```

### Execution Order

```
Request
  ↓
rateLimitHandle (before)
  ↓
i18nHandle (before)
  ↓
authHandle (before)
  ↓
Route handler (+page.server.ts / +server.ts)
  ↓
authHandle (after)
  ↓
i18nHandle (after)
  ↓
rateLimitHandle (after)
  ↓
Response
```

---

## Better Auth Integration

Better Auth provides a SvelteKit handler:

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

// Rate limiting
const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Implementation
  return resolve(event);
};

// Better Auth handler
const authHandle: Handle = async ({ event, resolve }) => {
  // Let Better Auth handle /api/auth/* routes
  const authResponse = await svelteKitHandler({ auth, event });
  if (authResponse) {
    return authResponse;
  }

  // For other routes, populate locals
  const session = await auth.api.getSession({
    headers: event.request.headers
  });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  return resolve(event);
};

export const handle = sequence(rateLimitHandle, authHandle);
```

---

## Rate Limiting

Using `sveltekit-rate-limiter`:

```typescript
// src/lib/server/rate-limit.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';

export const limiter = new RateLimiter({
  IP: [100, 'h'],        // 100 requests per hour per IP
  IPUA: [50, 'm'],       // 50 requests per minute per IP+UserAgent
  cookie: {
    name: 'rl',
    secret: process.env.RATE_LIMIT_SECRET!,
    rate: [10, 's'],     // 10 requests per second per cookie
    preflight: true
  }
});
```

```typescript
// src/hooks.server.ts
import { limiter } from '$lib/server/rate-limit';

const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Skip rate limiting for static assets
  if (event.url.pathname.startsWith('/_app')) {
    return resolve(event);
  }

  const status = await limiter.check(event);
  if (status.limited) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(status.retryAfter)
      }
    });
  }

  return resolve(event);
};
```

---

## CORS

For API routes that need cross-origin access:

```typescript
// src/hooks.server.ts
const ALLOWED_ORIGINS = [
  'https://example.com',
  'https://app.example.com'
];

const corsHandle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('origin');

  // Handle preflight
  if (event.request.method === 'OPTIONS') {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    return new Response(null, { status: 403 });
  }

  const response = await resolve(event);

  // Add CORS headers to actual response
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  return response;
};
```

---

## Security Headers

Add security headers to all responses:

```typescript
// src/hooks.server.ts
const securityHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP (adjust based on needs)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );

  return response;
};
```

---

## Handle Fetch

Intercept server-side `fetch()` calls:

```typescript
// src/hooks.server.ts
import type { HandleFetch } from '@sveltejs/kit';

export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
  // Forward cookies to same-origin API calls
  if (request.url.startsWith(event.url.origin)) {
    request.headers.set('cookie', event.request.headers.get('cookie') ?? '');
  }

  // Add auth header for external API
  if (request.url.startsWith('https://api.external.com')) {
    request.headers.set('Authorization', `Bearer ${process.env.EXTERNAL_API_KEY}`);
  }

  return fetch(request);
};
```

---

## Handle Error

Global error handler for unexpected errors:

```typescript
// src/hooks.server.ts
import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const errorId = crypto.randomUUID();

  // Log to console (or Sentry, etc.)
  console.error({
    errorId,
    status,
    message,
    path: event.url.pathname,
    error
  });

  // Return safe error info to client
  return {
    message: status === 500 ? 'Internal Server Error' : message,
    errorId
  };
};
```

See [error-handling.md](./error-handling.md) for comprehensive error handling patterns.

---

## Reroute Hook

URL rewriting before routing:

```typescript
// src/hooks.ts (not hooks.server.ts!)
import type { Reroute } from '@sveltejs/kit';

export const reroute: Reroute = ({ url }) => {
  // Rewrite /blog/old-slug to /blog/new-slug
  if (url.pathname === '/blog/old-slug') {
    return '/blog/new-slug';
  }

  // Locale stripping (handled by i18n usually)
  const match = url.pathname.match(/^\/(en|de|fr)(\/.*)?$/);
  if (match) {
    return match[2] || '/';
  }
};
```

---

## Full Example

Complete `hooks.server.ts` with all patterns:

> **Hook Order:** Rate Limit → CORS → Security Headers → Auth. This order ensures:
> 1. Abusive requests are blocked before consuming resources
> 2. CORS preflight (OPTIONS) bypasses rate limiting and returns immediately
> 3. Security headers are applied to all responses
> 4. Authentication runs last (most expensive operation)

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { limiter } from '$lib/server/rate-limit';
import { ALLOWED_ORIGINS } from '$env/static/private';
import type { Handle, HandleFetch, HandleServerError } from '@sveltejs/kit';

const allowedOrigins = ALLOWED_ORIGINS?.split(',') ?? [];

// 1. Rate limiting (with OPTIONS exemption for CORS preflight)
const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Skip static assets
  if (event.url.pathname.startsWith('/_app')) {
    return resolve(event);
  }

  // Skip rate limiting for CORS preflight requests
  if (event.request.method === 'OPTIONS') {
    return resolve(event);
  }

  const status = await limiter.check(event);
  if (status.limited) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(status.retryAfter) },
    });
  }
  return resolve(event);
};

// 2. CORS handling
const corsHandle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('Origin');

  // Handle preflight requests
  if (event.request.method === 'OPTIONS') {
    if (origin && allowedOrigins.includes(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    return new Response(null, { status: 403 });
  }

  const response = await resolve(event);

  // Add CORS headers to API responses
  if (event.url.pathname.startsWith('/api') && origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
};

// 3. Security headers
const securityHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return response;
};

// 4. Authentication
const authHandle: Handle = async ({ event, resolve }) => {
  const authResponse = await svelteKitHandler({ auth, event });
  if (authResponse) return authResponse;

  const session = await auth.api.getSession({
    headers: event.request.headers
  });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  return resolve(event);
};

// Compose in order: Rate Limit → CORS → Security → Auth
export const handle = sequence(
  rateLimitHandle,
  corsHandle,
  securityHandle,
  authHandle
);

// Server-side fetch interception
export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
  if (request.url.startsWith(event.url.origin)) {
    request.headers.set('cookie', event.request.headers.get('cookie') ?? '');
  }
  return fetch(request);
};

// Global error handler
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const errorId = crypto.randomUUID();
  console.error({ errorId, status, path: event.url.pathname, error });
  return {
    message: status === 500 ? 'Internal Server Error' : message,
    errorId
  };
};
```

---

## TypeScript Definitions

```typescript
// src/app.d.ts
import type { User, Session } from 'better-auth';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      locale: string;
      requestId: string;
    }
    interface Error {
      message: string;
      errorId?: string;
    }
    interface PageData {}
    interface PageState {}
    interface Platform {}
  }
}

export {};
```

---

## Related

- [rate-limiting.md](./rate-limiting.md) - Rate limiting patterns (sveltekit-rate-limiter, Upstash)
- [error-handling.md](./error-handling.md) - Error handling patterns
- [auth.md](./auth.md) - Authentication implementation
- [api.md](./api.md) - API route patterns
