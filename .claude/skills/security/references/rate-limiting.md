# Rate Limiting

## Why Not Better Auth Rate Limiting?

Better Auth's built-in rate limiting has issues:
1. IP header spoofing can bypass it
2. Memory storage resets on deployment
3. Limited configuration options

Use `sveltekit-rate-limiter` instead.

## Basic Usage

```typescript
// src/routes/api/login/+server.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';
import type { RequestHandler } from './$types';

const limiter = new RateLimiter({
  IP: [10, 'h'],      // 10 requests per hour per IP
  IPUA: [5, 'm'],     // 5 requests per minute per IP+UserAgent
});

export const POST: RequestHandler = async (event) => {
  const status = await limiter.check(event);

  if (status.limited) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': status.retryAfter.toString(),
        },
      }
    );
  }

  // Process login
};
```

## Rate Limit Identifiers

| Identifier | What It Tracks | Use Case |
|------------|----------------|----------|
| `IP` | IP address | General rate limiting |
| `IPUA` | IP + User-Agent | Stricter per-client limit |
| `cookie` | Secure cookie | Authenticated users |

### Cookie-Based (Most Secure)

```typescript
const limiter = new RateLimiter({
  cookie: {
    name: 'rl_token',
    secret: process.env.RATE_LIMIT_SECRET!, // Required
    rate: [5, 'm'],
    preflight: true, // Check before expensive operations
  },
});
```

**Why cookies?**
- Can't be spoofed like IP headers
- Persists across requests
- Server-controlled

## Correct IP Detection

### Problem: IP Spoofing

```typescript
// WRONG - X-Forwarded-For can be spoofed
const ip = request.headers.get('x-forwarded-for');
```

### Vercel Solution

```typescript
const limiter = new RateLimiter({
  IP: [10, 'h'],
  getIP: (event) => {
    // Vercel sets this from edge, can't be spoofed
    return event.getClientAddress();
  },
});
```

### Cloudflare Solution

```typescript
const limiter = new RateLimiter({
  IP: [10, 'h'],
  getIP: (event) => {
    // Cloudflare's verified client IP
    return event.request.headers.get('cf-connecting-ip') || 'unknown';
  },
});
```

## Endpoint-Specific Limits

```typescript
// src/lib/server/rate-limiters.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';

// Strict for auth endpoints
export const authLimiter = new RateLimiter({
  IP: [5, 'h'],
  IPUA: [3, 'm'],
});

// Moderate for API
export const apiLimiter = new RateLimiter({
  IP: [100, 'h'],
  IPUA: [20, 'm'],
});

// Lenient for public content
export const publicLimiter = new RateLimiter({
  IP: [1000, 'h'],
});
```

```typescript
// src/routes/api/auth/login/+server.ts
import { authLimiter } from '$lib/server/rate-limiters';

export const POST: RequestHandler = async (event) => {
  if ((await authLimiter.check(event)).limited) {
    return new Response('Too many login attempts', { status: 429 });
  }
  // ...
};
```

## Global Rate Limiting (hooks.server.ts)

```typescript
// src/hooks.server.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';
import type { Handle } from '@sveltejs/kit';

const globalLimiter = new RateLimiter({
  IP: [1000, 'h'],
});

export const handle: Handle = async ({ event, resolve }) => {
  // Skip for static assets
  if (event.url.pathname.startsWith('/static')) {
    return resolve(event);
  }

  const status = await globalLimiter.check(event);
  if (status.limited) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: { 'Retry-After': status.retryAfter.toString() },
    });
  }

  return resolve(event);
};
```

## Distributed Rate Limiting (Redis/Upstash)

For multi-instance deployments, use `@upstash/ratelimit` with `@upstash/redis`:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
});

export const POST: RequestHandler = async (event) => {
  const ip = event.getClientAddress();
  const { success, reset } = await ratelimit.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': retryAfter.toString() },
    });
  }
  // ...
};
```

## Response Headers

Always include rate limit information:

```typescript
const status = await limiter.check(event);

return new Response(JSON.stringify(data), {
  headers: {
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': status.remaining.toString(),
    'X-RateLimit-Reset': status.reset.toString(),
  },
});
```

## Testing Rate Limits

```typescript
// tests/rate-limit.test.ts
import { expect, test } from '@playwright/test';

test('rate limiting works', async ({ request }) => {
  // Make requests up to limit
  for (let i = 0; i < 5; i++) {
    const response = await request.post('/api/login', {
      data: { email: 'test@test.com', password: 'wrong' },
    });
    expect(response.status()).toBe(401); // Wrong password
  }

  // Next request should be rate limited
  const response = await request.post('/api/login', {
    data: { email: 'test@test.com', password: 'wrong' },
  });
  expect(response.status()).toBe(429);
  expect(response.headers()['retry-after']).toBeDefined();
});
```

## Common Mistakes

**Not handling Retry-After:**
```typescript
// WRONG - no retry information
return new Response('Too many requests', { status: 429 });

// RIGHT - include Retry-After header
return new Response('Too many requests', {
  status: 429,
  headers: { 'Retry-After': status.retryAfter.toString() },
});
```

**Rate limiting static assets:**
```typescript
// WRONG - wastes resources
if (status.limited) { return 429; }
// applies to everything including .js, .css

// RIGHT - skip static
if (event.url.pathname.match(/\.(js|css|png|jpg|ico)$/)) {
  return resolve(event);
}
```

**Same limit for all endpoints:**
```typescript
// WRONG - login should be stricter than search
const limiter = new RateLimiter({ IP: [100, 'h'] });

// RIGHT - endpoint-specific limits
const authLimiter = new RateLimiter({ IP: [5, 'h'] });
const searchLimiter = new RateLimiter({ IP: [100, 'h'] });
```
