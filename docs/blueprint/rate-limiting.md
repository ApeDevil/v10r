# Rate Limiting

Request rate limiting to prevent abuse, brute force attacks, and resource exhaustion.

**Technology:** [sveltekit-rate-limiter](https://github.com/ciscoheat/sveltekit-rate-limiter) (primary), [Upstash](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) (production scaling)

---

## Why External Rate Limiting

> **Critical:** Better Auth's built-in rate limiting is **BROKEN** ([GitHub Issue #2153](https://github.com/better-auth/better-auth/issues/2153), [#2112](https://github.com/better-auth/better-auth/issues/2112), [#1891](https://github.com/better-auth/better-auth/issues/1891)).

```typescript
// BROKEN - DO NOT USE
export const auth = betterAuth({
  rateLimit: { window: 60, max: 10 }, // This does NOT work!
});
```

Use `sveltekit-rate-limiter` instead. It's:
- Built specifically for SvelteKit
- Actively maintained
- Integrates with Superforms
- Works in serverless environments

---

## Installation

```bash
bun add sveltekit-rate-limiter
```

---

## Strategy

| Layer | Scope | Purpose |
|-------|-------|---------|
| Global (hooks) | All requests | DDoS protection, baseline limits (100/min) |
| Auth (hooks) | `/api/auth/*` | Brute force protection (5/min) |
| Route-specific | Sensitive endpoints | Password reset, API mutations |
| Superforms | Form submissions | Spam prevention |

> **Critical:** Auth endpoints MUST use stricter limits than global. The hook should detect `/api/auth/*` paths and apply `authLimiter` (5/min) instead of `globalLimiter` (100/min). See [middleware.md](./middleware.md) for the full implementation.

### Rate Limit Types

| Identifier | Use Case | Evasion Resistance |
|------------|----------|-------------------|
| IP | Anonymous users | Low (VPNs, proxies) |
| IP + User-Agent | Better fingerprinting | Medium |
| Cookie | Authenticated tracking | High (requires JS) |
| User ID | Per-user limits | Highest |

---

## Global Rate Limiting

Apply baseline limits to all requests in `hooks.server.ts`:

### Configuration

```typescript
// src/lib/server/rate-limit.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';
import { RATE_LIMIT_SECRET } from '$env/static/private';

export const globalLimiter = new RateLimiter({
  // IP-based: 100 requests per minute
  IP: [100, 'm'],

  // IP + User-Agent: 50 requests per 30 seconds
  IPUA: [50, '30s'],

  // Cookie-based: 200 requests per minute (authenticated users)
  cookie: {
    name: 'rl_id',
    secret: RATE_LIMIT_SECRET,
    rate: [200, 'm'],
    preflight: true, // Set cookie on first request
  },
});
```

### Time Units

| Unit | Meaning |
|------|---------|
| `'s'` | Seconds |
| `'m'` | Minutes |
| `'h'` | Hours |
| `'d'` | Days |
| `'15m'` | 15 minutes |
| `'2h'` | 2 hours |

### Hook Integration

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { globalLimiter, authLimiter } from '$lib/server/rate-limit';
import type { Handle } from '@sveltejs/kit';

const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Skip static assets
  if (event.url.pathname.startsWith('/_app')) {
    return resolve(event);
  }

  // Let OPTIONS pass through to CORS handler
  // (Don't return early, or CORS headers won't be added!)
  if (event.request.method === 'OPTIONS') {
    return resolve(event);
  }

  // Use stricter limiter for auth endpoints (brute force protection)
  const limiter = event.url.pathname.startsWith('/api/auth')
    ? authLimiter
    : globalLimiter;

  const status = await limiter.check(event);

  if (status.limited) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(status.retryAfter),
        'X-RateLimit-Limit': String(status.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + status.retryAfter),
      },
    });
  }

  // Add rate limit headers to successful responses
  const response = await resolve(event);
  try {
    response.headers.set('X-RateLimit-Limit', String(status.limit));
    response.headers.set('X-RateLimit-Remaining', String(status.remaining));
  } catch {
    // Headers immutable (e.g., redirect response)
  }

  return response;
};

// Order: rate limit FIRST (before expensive auth checks)
export const handle = sequence(
  rateLimitHandle,
  // ... other handlers (CORS, security headers, auth)
);
```

---

## Route-Specific Limits

Apply stricter limits to sensitive endpoints:

### Auth Endpoints

```typescript
// src/lib/server/rate-limit.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';

// Strict limits for auth endpoints
export const authLimiter = new RateLimiter({
  IP: [5, 'm'],      // 5 attempts per minute per IP
  IPUA: [3, 'm'],    // 3 attempts per minute per IP+UA
});

// Password reset: very strict
export const passwordResetLimiter = new RateLimiter({
  IP: [3, 'h'],      // 3 requests per hour per IP
});

// API mutations: moderate
export const apiMutationLimiter = new RateLimiter({
  IP: [30, 'm'],     // 30 mutations per minute
});
```

### Using in +server.ts

```typescript
// src/routes/api/auth/login/+server.ts
import { json, error } from '@sveltejs/kit';
import { authLimiter } from '$lib/server/rate-limit';

export async function POST(event) {
  // Check rate limit
  const status = await authLimiter.check(event);
  if (status.limited) {
    error(429, {
      message: 'Too many login attempts. Try again later.',
      retryAfter: status.retryAfter,
    });
  }

  // Proceed with login...
}
```

### Using in +page.server.ts

```typescript
// src/routes/auth/forgot-password/+page.server.ts
import { fail } from '@sveltejs/kit';
import { passwordResetLimiter } from '$lib/server/rate-limit';

export const actions = {
  default: async (event) => {
    const status = await passwordResetLimiter.check(event);
    if (status.limited) {
      return fail(429, {
        message: `Too many requests. Try again in ${status.retryAfter} seconds.`,
      });
    }

    // Proceed with password reset...
  },
};
```

---

## Superforms Integration

`sveltekit-rate-limiter` integrates directly with Superforms:

```typescript
// src/routes/contact/+page.server.ts
import { superValidate, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { RateLimiter } from 'sveltekit-rate-limiter/server';
import { contactSchema } from '$lib/schemas/contact';

const limiter = new RateLimiter({
  IP: [5, 'h'],  // 5 contact form submissions per hour
});

export const actions = {
  default: async (event) => {
    const form = await superValidate(event, valibot(contactSchema));

    // Check rate limit
    const status = await limiter.check(event);
    if (status.limited) {
      return message(form, 'Too many submissions. Please try again later.', {
        status: 429,
      });
    }

    if (!form.valid) {
      return fail(400, { form });
    }

    // Process form...
    return message(form, 'Message sent!');
  },
};
```

---

## Per-User Limits

For authenticated users, limit by user ID instead of IP:

```typescript
// src/lib/server/rate-limit.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';

export const userApiLimiter = new RateLimiter({
  // Custom rate limit function
  rates: {
    // 100 requests per minute per user
    userId: async (event) => {
      const userId = event.locals.user?.id;
      if (!userId) return null; // Fall back to other limiters
      return { hash: userId, rate: [100, 'm'] };
    },
  },
  // Fallback for unauthenticated requests
  IP: [20, 'm'],
});
```

```typescript
// src/routes/api/items/+server.ts
import { userApiLimiter } from '$lib/server/rate-limit';

export async function POST(event) {
  const status = await userApiLimiter.check(event);
  if (status.limited) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  // Proceed...
}
```

---

## Production: Upstash Redis

For distributed rate limiting across serverless functions, use Upstash:

### Why Upstash

| Feature | In-Memory | Upstash |
|---------|-----------|---------|
| Serverless compatible | No (state lost) | Yes |
| Distributed | No | Yes |
| Free tier | N/A | 10K requests/day |
| Latency | ~0ms | ~1-2ms |

### Installation

```bash
bun add @upstash/ratelimit @upstash/redis
```

### Configuration

```typescript
// src/lib/server/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/static/private';

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

// Sliding window: 100 requests per 60 seconds
export const upstashLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true,
  prefix: 'velociraptor',
});
```

### Usage

```typescript
// src/hooks.server.ts
import { upstashLimiter } from '$lib/server/rate-limit';

const rateLimitHandle: Handle = async ({ event, resolve }) => {
  // Let OPTIONS pass through to CORS handler
  if (event.request.method === 'OPTIONS') {
    return resolve(event);
  }

  const ip = event.getClientAddress();
  const { success, limit, remaining, reset } = await upstashLimiter.limit(ip);

  if (!success) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
      },
    });
  }

  const response = await resolve(event);
  try {
    response.headers.set('X-RateLimit-Limit', String(limit));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
  } catch {
    // Headers immutable (e.g., redirect response)
  }

  return response;
};
```

### Hybrid Approach

Use both for defense in depth:

```typescript
// src/lib/server/rate-limit.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { dev } from '$app/environment';

// Development: in-memory
const devLimiter = new RateLimiter({
  IP: [100, 'm'],
});

// Production: Upstash
const prodLimiter = dev ? null : new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(100, '60 s'),
});

export async function checkRateLimit(event: RequestEvent) {
  if (dev) {
    return devLimiter.check(event);
  }

  const ip = event.getClientAddress();
  const result = await prodLimiter!.limit(ip);

  return {
    limited: !result.success,
    limit: result.limit,
    remaining: result.remaining,
    retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
  };
}
```

---

## Rate Limit Headers

Always include rate limit headers in responses:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds until client can retry (429 only) |

```typescript
// Response headers example
{
  'X-RateLimit-Limit': '100',
  'X-RateLimit-Remaining': '42',
  'X-RateLimit-Reset': '1703462400',
  'Retry-After': '60'  // Only on 429 responses
}
```

---

## Recommended Limits

| Endpoint Type | Limit | Rationale |
|--------------|-------|-----------|
| Login/Register | 5/min per IP | Brute force protection |
| Password reset | 3/hour per IP | Prevent enumeration |
| Email verification | 3/hour per user | Prevent spam |
| API reads | 100/min per user | Normal usage |
| API writes | 30/min per user | Prevent spam |
| File uploads | 10/hour per user | Storage protection |
| Contact forms | 5/hour per IP | Spam prevention |

---

## Testing

### Disable in Development

```typescript
// src/lib/server/rate-limit.ts
import { dev } from '$app/environment';

export const authLimiter = new RateLimiter({
  IP: dev ? [1000, 's'] : [5, 'm'],  // Effectively disabled in dev
});
```

### Manual Testing

```bash
# Hit endpoint repeatedly to trigger limit
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/api/auth/login -X POST; done
```

---

## Environment Variables

```bash
# .env
RATE_LIMIT_SECRET=your-32-char-secret-for-cookie-signing

# Production (Upstash)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

---

## File Structure

```
src/
├── lib/
│   └── server/
│       └── rate-limit.ts    # All rate limiter instances
├── hooks.server.ts          # Global rate limiting
└── routes/
    ├── api/
    │   └── items/
    │       └── +server.ts   # Route-specific limits
    └── auth/
        └── login/
            └── +page.server.ts  # Form rate limits
```

---

## Summary

| What | How |
|------|-----|
| Global limits | `globalLimiter` in hooks (100/min) |
| Auth endpoints | `authLimiter` in hooks for `/api/auth/*` (5/min) |
| CORS preflight | OPTIONS requests bypass rate limiting |
| Immutable headers | Wrap `response.headers.set()` in try-catch |
| Forms | Superforms integration |
| Production | Upstash Redis for distributed limiting |
| Response | Always include `X-RateLimit-*` headers |

---

## Related

- [middleware.md](./middleware.md) - Hook composition patterns
- [auth.md](./auth.md) - Authentication (rate limiting note)
- [api.md](./api.md) - API endpoint patterns
- [error-handling.md](./error-handling.md) - 429 error handling

---

## Sources

- [sveltekit-rate-limiter](https://github.com/ciscoheat/sveltekit-rate-limiter)
- [Superforms Rate Limiting](https://superforms.rocks/rate-limiting)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Better Auth Issue #2153](https://github.com/better-auth/better-auth/issues/2153)
