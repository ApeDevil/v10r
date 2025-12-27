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

Better Auth provides a SvelteKit handler.

> **Critical for Vercel:** Configure `ipAddressHeaders` so Better Auth can identify client IPs behind Vercel's proxy. Without this, rate limiting and IP-based security features are broken.

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  // ... other config
  advanced: {
    ipAddress: {
      // Vercel provides validated IP headers
      ipAddressHeaders: ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip'],
    },
  },
});
```

### Hook Integration

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
import { RATE_LIMIT_SECRET } from '$env/static/private';

// Global rate limiter (100 requests/minute)
export const globalLimiter = new RateLimiter({
  IP: [100, 'm'],        // 100 requests per minute per IP
  IPUA: [50, 'm'],       // 50 requests per minute per IP+UserAgent
  cookie: {
    name: 'rl_id',
    secret: RATE_LIMIT_SECRET,
    rate: [200, 'm'],    // 200 requests per minute per cookie
    preflight: true,
  },
});

// Strict limiter for auth endpoints (brute force protection)
export const authLimiter = new RateLimiter({
  IP: [5, 'm'],          // 5 attempts per minute per IP
  IPUA: [3, 'm'],        // 3 attempts per minute per IP+UserAgent
});
```

```typescript
// src/hooks.server.ts
import { globalLimiter, authLimiter } from '$lib/server/rate-limit';

const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Skip rate limiting for static assets
  if (event.url.pathname.startsWith('/_app')) {
    return resolve(event);
  }

  // Use stricter limiter for auth endpoints
  const limiter = event.url.pathname.startsWith('/api/auth')
    ? authLimiter
    : globalLimiter;

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
const ALLOWED_ORIGINS = new Set([
  'https://example.com',
  'https://app.example.com'
]);

const corsHandle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('origin'); // lowercase per HTTP spec

  // Handle preflight
  if (event.request.method === 'OPTIONS') {
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true', // Required for credentialed requests
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    return new Response(null, { status: 403 });
  }

  const response = await resolve(event);

  // Add CORS headers to actual response
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    try {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    } catch {
      // Headers immutable (e.g., redirect response)
    }
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

  // Some responses (e.g., redirects) have immutable headers
  try {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // CSP - consider using nonce mode in svelte.config.js instead
    // response.headers.set('Content-Security-Policy', "...");
  } catch {
    // Headers immutable, return as-is
  }

  return response;
};
```

> **Note:** For production CSP, configure `csp.mode: 'auto'` in `svelte.config.js` to use nonces for SSR pages and hashes for prerendered content. The `'unsafe-inline'` fallback shown above provides no XSS protection.

---

## Handle Fetch

Intercept server-side `fetch()` calls:

```typescript
// src/hooks.server.ts
import type { HandleFetch } from '@sveltejs/kit';

export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
  // Forward cookies to same-origin API calls
  // Create new Request to avoid mutating the original
  if (request.url.startsWith(event.url.origin)) {
    const cookie = event.request.headers.get('cookie');
    if (cookie) {
      request = new Request(request, {
        headers: new Headers(request.headers)
      });
      request.headers.set('cookie', cookie);
    }
  }

  // Add auth header for external API
  if (request.url.startsWith('https://api.external.com')) {
    request = new Request(request, {
      headers: new Headers(request.headers)
    });
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
> 1. Abusive requests are blocked before consuming resources (OPTIONS exempt to allow CORS preflight)
> 2. CORS handler processes all OPTIONS requests and adds required headers
> 3. Security headers are applied to all responses (with immutable header protection)
> 4. Authentication runs last (most expensive operation)
>
> **Critical:** Auth routes get stricter rate limits (5/min vs 100/min global)

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { globalLimiter, authLimiter } from '$lib/server/rate-limit';
import { ALLOWED_ORIGINS } from '$env/static/private';
import type { Handle, HandleFetch, HandleServerError } from '@sveltejs/kit';

const allowedOrigins = new Set(ALLOWED_ORIGINS?.split(',') ?? []);

// 1. Rate limiting (OPTIONS passes through to CORS handler)
const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Skip static assets
  if (event.url.pathname.startsWith('/_app')) {
    return resolve(event);
  }

  // Let OPTIONS pass through - CORS handler will process it
  // (Don't return early here, or CORS headers won't be added!)
  if (event.request.method === 'OPTIONS') {
    return resolve(event);
  }

  // Stricter limits for auth endpoints (brute force protection)
  if (event.url.pathname.startsWith('/api/auth')) {
    const status = await authLimiter.check(event);
    if (status.limited) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(status.retryAfter) },
      });
    }
    return resolve(event);
  }

  // Global rate limit for all other routes
  const status = await globalLimiter.check(event);
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
  const origin = event.request.headers.get('origin'); // lowercase per HTTP spec

  // Handle preflight requests
  if (event.request.method === 'OPTIONS') {
    if (origin && allowedOrigins.has(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true', // Required for credentialed requests
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    return new Response(null, { status: 403 });
  }

  const response = await resolve(event);

  // Add CORS headers to API responses
  if (event.url.pathname.startsWith('/api') && origin && allowedOrigins.has(origin)) {
    try {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    } catch {
      // Response headers are immutable (e.g., from redirect), skip CORS headers
    }
  }

  return response;
};

// 3. Security headers (with immutable header protection)
const securityHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Some responses (e.g., redirects) have immutable headers
  // Wrap in try-catch to avoid crashing on Response.redirect()
  try {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  } catch {
    // Headers are immutable, return response as-is
  }

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
  // Forward cookies to same-origin API calls (create new Request to avoid mutation)
  if (request.url.startsWith(event.url.origin)) {
    const cookie = event.request.headers.get('cookie');
    if (cookie) {
      request = new Request(request, { headers: new Headers(request.headers) });
      request.headers.set('cookie', cookie);
    }
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
