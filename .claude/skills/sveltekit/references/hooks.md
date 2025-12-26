# Hooks

App-level functions that intercept requests and responses.

## Contents

- [File Locations](#file-locations) - hooks.server.ts, hooks.client.ts, hooks.ts
- [Server Hooks](#server-hooks) - handle, handleFetch, handleError
- [Sequence Multiple Handles](#sequence-multiple-handles) - Compose handlers
- [Client Hooks](#client-hooks) - handleError for navigation errors
- [event.locals](#eventlocals) - Pass data between hooks and routes
- [Protect Routes](#protect-routes) - Auth guard patterns
- [CSRF Protection](#csrf-protection) - Built-in protection, trusted origins
- [Content Security Policy](#content-security-policy) - Header-based and config-based
- [Rate Limiting Hook](#rate-limiting-hook) - sveltekit-rate-limiter

## File Locations

| File | Runs Where |
|------|------------|
| `src/hooks.server.ts` | Server only |
| `src/hooks.client.ts` | Client only |
| `src/hooks.ts` | Both (shared types) |

## Server Hooks

### handle

Runs on every request before routing:

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Auth: Parse session before any route runs
  const sessionId = event.cookies.get('session');
  if (sessionId) {
    event.locals.user = await db.users.findBySession(sessionId);
  }

  // 2. Timing
  const start = performance.now();

  // 3. Call SvelteKit's route resolution
  const response = await resolve(event, {
    // Transform HTML (optional)
    transformPageChunk: ({ html }) => html.replace('%lang%', 'en'),

    // Filter serialized data (optional)
    filterSerializedResponseHeaders: (name) => name !== 'x-internal'
  });

  // 4. Add custom headers
  const duration = performance.now() - start;
  response.headers.set('x-response-time', `${duration.toFixed(2)}ms`);

  return response;
};
```

### Sequence Multiple Handles

```typescript
import { sequence } from '@sveltejs/kit/hooks';
import { handleAuth } from './auth';
import { handleI18n } from './i18n';
import { handleLogging } from './logging';

export const handle = sequence(handleAuth, handleI18n, handleLogging);
```

### handleFetch

Intercept fetch calls during SSR:

```typescript
import type { HandleFetch } from '@sveltejs/kit';

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  // Rewrite public URL to internal during SSR
  if (request.url.startsWith('https://api.myapp.com')) {
    request = new Request(
      request.url.replace('https://api.myapp.com', 'http://localhost:3000'),
      request
    );
  }

  // Forward auth headers to internal API
  if (request.url.startsWith('http://localhost:3000')) {
    request.headers.set('authorization', event.request.headers.get('authorization') ?? '');
  }

  return fetch(request);
};
```

### handleError (server)

Handle unexpected errors:

```typescript
import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  // error.message may contain sensitive info - don't expose
  // message is already sanitized for users

  // Log to monitoring
  console.error('Server error:', error);

  // Optionally send to error tracking
  await sentry.captureException(error, {
    extra: {
      url: event.url.pathname,
      status
    }
  });

  // Return custom error object (available in +error.svelte)
  return {
    message: 'Something went wrong',
    code: 'INTERNAL_ERROR'
  };
};
```

## Client Hooks

### handleError (client)

Handle client-side navigation errors:

```typescript
// src/hooks.client.ts
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
  // Log to monitoring
  console.error('Client error:', error);

  return {
    message: 'Navigation failed',
    code: 'CLIENT_ERROR'
  };
};
```

## event.locals

Pass data between hooks and routes:

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: { id: string; email: string; role: string } | null;
      requestId: string;
    }
  }
}

export {};
```

```typescript
// src/hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.requestId = crypto.randomUUID();
  event.locals.user = await getUser(event.cookies);

  return resolve(event);
};
```

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/login');
  }

  return { user: locals.user };
};
```

## Protect Routes

```typescript
// src/hooks.server.ts
const protectedPaths = ['/dashboard', '/admin', '/settings'];

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await getUser(event.cookies);

  // Check protected routes
  const isProtected = protectedPaths.some(path =>
    event.url.pathname.startsWith(path)
  );

  if (isProtected && !event.locals.user) {
    redirect(303, `/login?redirectTo=${event.url.pathname}`);
  }

  // Admin-only routes
  if (event.url.pathname.startsWith('/admin')) {
    if (event.locals.user?.role !== 'admin') {
      error(403, 'Admin access required');
    }
  }

  return resolve(event);
};
```

## CSRF Protection

SvelteKit has built-in CSRF protection for form submissions. Configure trusted origins:

```javascript
// svelte.config.js
export default {
  kit: {
    csrf: {
      trustedOrigins: ['https://myapp.com', 'https://staging.myapp.com']
    }
  }
};
```

## Content Security Policy

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'"
  ].join('; '));

  return response;
};
```

Or use config-based CSP:

```javascript
// svelte.config.js
export default {
  kit: {
    csp: {
      mode: 'auto',
      directives: {
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline']
      }
    }
  }
};
```

## Rate Limiting Hook

```typescript
import { RateLimiter } from 'sveltekit-rate-limiter';

const limiter = new RateLimiter({
  IP: [100, 'm'],        // 100 requests per minute
  IPUA: [50, 'm']        // 50 per IP + User Agent
});

export const handle: Handle = async ({ event, resolve }) => {
  const limited = await limiter.check(event);
  if (limited) {
    error(429, 'Too many requests');
  }

  return resolve(event);
};
```
