# Hooks Integration

SvelteKit hooks configuration for Better Auth.

## Contents

- [Basic Setup](#basic-setup) - svelteKitHandler + session handler
- [Why Two Handlers?](#why-two-handlers) - Separation of concerns
- [Adding More Handlers](#adding-more-handlers) - Logging, CORS, custom
- [Handler Order](#handler-order) - Correct sequencing
- [Accessing Session in Handlers](#accessing-session-in-handlers) - After sessionHandle
- [Conditional Session Loading](#conditional-session-loading) - Skip for static assets
- [HandleFetch Hook](#handlefetch-hook) - Forward cookies during SSR
- [Error Handling](#error-handling) - HandleServerError
- [App.d.ts Types](#appd.ts-types) - TypeScript definitions
- [Testing Hooks](#testing-hooks) - Mock event.locals

## Basic Setup

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';

// Handler 1: Better Auth API routes
const authHandle: Handle = async ({ event, resolve }) => {
  return svelteKitHandler({ event, resolve, auth });
};

// Handler 2: Populate event.locals
const sessionHandle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({
    headers: event.request.headers
  });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;
  return resolve(event);
};

export const handle = sequence(authHandle, sessionHandle);
```

## Why Two Handlers?

| Handler | Responsibility |
|---------|----------------|
| `svelteKitHandler` | Handles `/api/auth/*` endpoints only |
| `sessionHandle` | Populates `event.locals` for all routes |

**Critical:** `svelteKitHandler` does NOT populate `event.locals`. You must call `auth.api.getSession()` separately.

## Adding More Handlers

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';

// Auth handlers
const authHandle: Handle = ...
const sessionHandle: Handle = ...

// Logging
const loggingHandle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const response = await resolve(event);
  console.log(`${event.request.method} ${event.url.pathname} - ${Date.now() - start}ms`);
  return response;
};

// CORS (if needed for API)
const corsHandle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/')) {
    if (event.request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
  }
  return resolve(event);
};

// Compose all handlers
export const handle = sequence(
  loggingHandle,
  corsHandle,
  authHandle,
  sessionHandle
);
```

## Handler Order

Order matters! Place handlers in this sequence:

1. **Logging** - First to capture all requests
2. **CORS** - Early to handle preflight
3. **Auth API** - Handle auth endpoints
4. **Session** - Populate locals for remaining handlers
5. **Custom logic** - Anything that needs session

## Accessing Session in Handlers

```typescript
// This handler runs AFTER sessionHandle
const customHandle: Handle = async ({ event, resolve }) => {
  // event.locals.user is available here
  if (event.locals.user) {
    console.log(`Request from user: ${event.locals.user.id}`);
  }
  return resolve(event);
};

export const handle = sequence(
  authHandle,
  sessionHandle,
  customHandle  // Must come after sessionHandle
);
```

## Conditional Session Loading

Skip session loading for static assets:

```typescript
const sessionHandle: Handle = async ({ event, resolve }) => {
  // Skip for static files and assets
  if (
    event.url.pathname.startsWith('/_app/') ||
    event.url.pathname.startsWith('/favicon')
  ) {
    return resolve(event);
  }

  const session = await auth.api.getSession({
    headers: event.request.headers
  });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;
  return resolve(event);
};
```

## HandleFetch Hook

Rewrite internal API calls during SSR:

```typescript
// src/hooks.server.ts
import type { HandleFetch } from '@sveltejs/kit';

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  // Forward cookies for internal API calls
  if (request.url.startsWith(event.url.origin)) {
    request.headers.set('cookie', event.request.headers.get('cookie') ?? '');
  }
  return fetch(request);
};
```

## Error Handling

```typescript
import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({ error, event }) => {
  console.error('Server error:', error);

  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  };
};
```

## App.d.ts Types

```typescript
// src/app.d.ts
import type { User, Session } from 'better-auth';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
    }
    interface Error {
      message: string;
      code?: string;
    }
  }
}

export {};
```

## Testing Hooks

```typescript
// For testing, you can mock event.locals
const mockEvent = {
  locals: {
    user: { id: 'usr_123', email: 'test@example.com' },
    session: { id: 'ses_123', userId: 'usr_123' },
  },
  // ... other event properties
};
```
