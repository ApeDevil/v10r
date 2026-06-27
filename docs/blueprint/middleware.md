# Middleware

SvelteKit hooks for request interception, authentication, and cross-cutting concerns.

## Overview

| Hook | Purpose | File |
|------|---------|------|
| `handle` | Intercept every request | `hooks.server.ts` |
| `handleFetch` | Intercept server-side fetches | `hooks.server.ts` |
| `handleError` | Global error handler | `hooks.server.ts` |

This project does not use a `reroute` hook — locale routing lives in the route tree (`[[locale=locale]]` catch-all); see [i18n.md](./i18n.md).

**`handle` sequence order** (`src/hooks.server.ts` is the SSOT): Security Headers (+ client-IP stamp) → strip `/en/` → Load Style → i18n → Auth Captcha Gate → Auth (rate-limit + Better Auth) → CSRF → Session Populate (+ path-gated `grants`) → Consent → Debug-Owner → Dev Route Guard → Analytics. Note the live order: security headers run **first** (to stamp the trusted IP), rate-limiting lives inside the auth handler, and CSRF runs **after** auth.

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

> **Pin the IP source.** `ipAddressHeaders` is pinned to a single trusted header so Better Auth never reads the attacker-mutable `x-forwarded-for` chain.

```typescript
// src/lib/server/auth/index.ts
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  // ... other config
  advanced: {
    ipAddress: {
      // Single trusted source — stamped once in securityHeaders
      ipAddressHeaders: ['x-client-ip'],
    },
  },
});
```

`x-client-ip` is stamped once in the `securityHeaders` handler from `event.getClientAddress()` (the platform-trusted source) before any handler runs. Better Auth reads only that stamp, not the forwarded-for chain a client can spoof.

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

Limiters are built by the `createLimiter` factory over `@upstash/ratelimit` (sliding window) backed by Upstash Redis. There is no global hook limiter and no cookie secret — the hook applies per-route limiters and fails closed in production. See [abuse/rate-limits.md](./abuse/rate-limits.md) for the factory and the full limiter table; do not redefine limiters here.

The `authHandler` hook rate-limits every `/api/auth/*` request by client IP, then applies a second per-account limiter on the two-factor verify paths:

```typescript
// src/hooks.server.ts
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';

const authRatelimit = createLimiter('ratelimit:auth', AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW);

const authHandler: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;

  if (path.startsWith('/api/auth/') && event.locals.clientIp) {
    const { success, reset } = await authRatelimit.limit(event.locals.clientIp);
    if (!success) return rateLimitResponse(reset);
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
```

`event.locals.clientIp` is stamped once in the first handler (`securityHeaders`) before any other handler reads it; downstream code reads it rather than re-deriving from attacker-mutable request headers. The per-email and captcha gates run in a separate `authCaptchaGate` handler — see [abuse/rate-limits.md](./abuse/rate-limits.md).

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

> **Live header set.** The running `securityHeaders` handler also emits `Cross-Origin-Opener-Policy: same-origin-allow-popups` (OAuth popups still work), `Cross-Origin-Resource-Policy: same-site`, and `X-DNS-Prefetch-Control: off`. It conditionally adds `Cache-Control: no-store, private` on authed-or-`/api/` responses (guarded by `!response.headers.has('Cache-Control')` so an explicit per-route setter wins) and `Clear-Site-Data` on a successful `/api/auth/sign-out`. See [system-abstraction.md](../system-abstraction.md#security-headers-set) for the full table.

> **CSP** is configured in `svelte.config.js`, not in this handler. `img-src` is restricted to explicit origins (`self`, `data:`, `blob:`, R2, `basemaps.cartocdn.com`, `avatars.githubusercontent.com`) rather than a blanket `https:`. `style-src` still requires `'unsafe-inline'` — Svelte transitions inject inline styles, a known constraint. For SSR pages prefer `csp.mode: 'auto'` (nonces) over the `'unsafe-inline'` fallback shown above, which provides no XSS protection.

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

## Scheduler Bootstrap

The in-process job scheduler starts via a bare import at the top of `hooks.server.ts`:

```typescript
// src/hooks.server.ts
import '$lib/server/jobs/scheduler';
```

The import runs the scheduler module once at startup. The module itself guards against duplicate intervals (HMR) and skips execution during Vite builds. On Vercel (serverless), it detects `platform.persistent = false` and does nothing.

See [deployment.md](./deployment.md#scheduled-jobs) for the full jobs system.

---

## Full Example

Complete `hooks.server.ts` with all patterns:

> **Hook Order (live, per `src/hooks.server.ts`):** Security Headers (+ client-IP stamp) → strip `/en/` → Load Style → i18n → Auth Captcha Gate → Auth (rate-limit + Better Auth) → CSRF → Session Populate → Consent → Debug-Owner → Dev Route Guard → Analytics. Key points:
> 1. Security headers run **first** — they stamp the trusted `x-client-ip` that every later handler reads instead of the attacker-mutable forwarded-for chain (response headers are added post-`resolve`).
> 2. Style + locale populate render context; both skip `/api` and internal subrequests.
> 3. Rate-limiting lives **inside the auth handler** — `/api/auth/*` rejects before Better Auth runs.
> 4. CSRF runs **after** auth, on mutating `/api/*` (custom-header + same-host origin/referer check).
> 5. Session populate reads the session into `locals` and queries `grants` only on `/blog`/`/desk` paths.
>
> **Critical:** Auth routes get stricter rate limits (5/min). The handlers below illustrate individual patterns; the live composition is mirrored at the end of this section.

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { ALLOWED_ORIGINS } from '$env/static/private';
import type { Handle, HandleFetch, HandleServerError } from '@sveltejs/kit';
import '$lib/server/jobs/scheduler'; // starts in-process scheduler (container only, no-op on Vercel)

const allowedOrigins = new Set(ALLOWED_ORIGINS?.split(',') ?? []);
const authRatelimit = createLimiter('ratelimit:auth', AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW);

// 1. Rate limiting — per-route Upstash limiter, keyed on the stamped client IP.
const rateLimitHandle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/auth/') && event.locals.clientIp) {
    const { success, reset } = await authRatelimit.limit(event.locals.clientIp);
    if (!success) return rateLimitResponse(reset);
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

// 3. CSRF protection for JSON APIs (SvelteKit only protects form submissions)
// Live predicates are extracted to $lib/server/security/csrf.ts
// (needsCsrf, isSameHost, CSRF_EXEMPT_PREFIXES) and imported by the hook.
// The live handler checks X-Requested-With AND a same-host Origin/Referer on
// mutating /api/* requests. Exempt prefixes: /api/auth/, /api/cron/,
// /api/webhooks/, /api/analytics/journey.
const csrfHandle: Handle = async ({ event, resolve }) => {
  // Only check state-changing requests with JSON content type
  if (
    event.request.method !== 'GET' &&
    event.request.method !== 'HEAD' &&
    event.request.method !== 'OPTIONS' &&
    event.request.headers.get('content-type')?.includes('application/json')
  ) {
    // Require custom header - browsers won't add this cross-origin
    if (!event.request.headers.get('x-requested-with')) {
      return new Response('CSRF token required', { status: 403 });
    }
  }
  return resolve(event);
};

// 4. Security headers (with immutable header protection)
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

// 5. Authentication + grant population
const authHandle: Handle = async ({ event, resolve }) => {
  const authResponse = await svelteKitHandler({ auth, event });
  if (authResponse) return authResponse;

  const session = await auth.api.getSession({
    headers: event.request.headers
  });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  // Populate active capability grants — path-gated. Grants are read only by the
  // blog-author guards (/api/blog/* + blog pages) and the desk, so query them
  // only on those paths; everywhere else the array stays empty (admins bypass via
  // isAdmin, so [] is safe). This skips the Neon round-trip on every other request.
  event.locals.grants =
    session?.user && (event.url.pathname.includes('/blog') || event.url.pathname.includes('/desk'))
      ? await listActiveGrantKinds(session.user.id)
      : [];

  return resolve(event);
};

// Live composition — mirrors src/hooks.server.ts (SSOT). The handlers above
// illustrate individual patterns; the real app wires them in this order (security
// headers FIRST to stamp the IP, rate-limit inside the auth handler, CSRF AFTER auth):
export const handle = sequence(
  securityHeaders,       // client-IP stamp + response security headers
  stripBaseLocalePrefix, // 308 /en/* → /*
  loadStyle,             // skips /api/ and internal subrequests
  i18n,                  // Paraglide locale + transformPageChunk
  authCaptchaGate,       // ALTCHA on email-sending auth routes
  authHandler,           // Upstash rate-limit + Better Auth /api/auth/*
  csrfProtection,        // mutating /api/* origin/referer check
  sessionPopulate,       // session → locals; path-gated grants
  consentLoader,
  debugOwnerLoader,
  devRouteGuard,
  analyticsCollector,
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
import type { GrantKind } from '$lib/server/auth/grants';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      grants: GrantKind[];   // active capability grants for this user; [] if unauthenticated
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

- [abuse/rate-limits.md](./abuse/rate-limits.md) - Rate limiting patterns (Upstash sliding window)
- [error-handling.md](./error-handling.md) - Error handling patterns
- [auth.md](./auth.md) - Authentication implementation
- [api.md](./api.md) - API route patterns
