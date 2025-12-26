# Gotchas

Critical issues and their solutions.

## Contents

- [Rate Limiting is BROKEN](#rate-limiting-is-broken) - Use external rate limiter
- [Session Cleanup Required](#session-cleanup-required) - Cron job for expired sessions
- [Cookie Caching Required](#cookie-caching-required) - Avoid DB hit on every request
- [svelteKitHandler Doesn't Populate Locals](#sveltekithandler-doesnt-populate-locals) - Manual session loading
- [useSession() SSR Leak](#usesession-ssr-leak) - Use page data instead
- [Missing Session Indexes](#missing-session-indexes) - Add performance indexes
- [Layout-Only Protection](#layout-only-protection) - Protect each route
- [OAuth Callback URL Mismatch](#oauth-callback-url-mismatch) - Configure trusted origins
- [Email Verification Tokens Expire](#email-verification-tokens-expire) - Extend expiration

## Rate Limiting is BROKEN

**Issue:** Better Auth's built-in rate limiting does not work (GitHub Issue #2153).

```typescript
// THIS DOES NOT WORK
export const auth = betterAuth({
  rateLimit: {
    window: 60,
    max: 10,
  },
});
```

**Solution:** Use external rate limiting:

### Option 1: sveltekit-rate-limiter (Simple)

```bash
bun add sveltekit-rate-limiter
```

```typescript
// src/hooks.server.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';

const limiter = new RateLimiter({
  IP: [10, 'm'],     // 10 requests per minute per IP
  IPUA: [5, 'm'],    // 5 requests per minute per IP+UserAgent
});

const rateLimitHandle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/auth')) {
    if (await limiter.isLimited(event)) {
      return new Response('Too many requests', { status: 429 });
    }
  }
  return resolve(event);
};

export const handle = sequence(rateLimitHandle, authHandle, sessionHandle);
```

### Option 2: Upstash (Production)

```bash
bun add @upstash/ratelimit @upstash/redis
```

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});
```

## Session Cleanup Required

**Issue:** Better Auth does NOT delete expired sessions. Your session table grows forever.

**Solution:** Create a cleanup cron job:

```typescript
// src/lib/server/jobs/session-cleanup.ts
import { db } from '$lib/server/db';
import { session } from '$lib/server/db/schema';
import { lt } from 'drizzle-orm';

export async function cleanupExpiredSessions() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1); // 24h grace period

  const result = await db
    .delete(session)
    .where(lt(session.expiresAt, cutoff))
    .returning({ id: session.id });

  console.log(`Cleaned up ${result.length} expired sessions`);
  return { deleted: result.length };
}
```

```typescript
// src/routes/api/cron/session-cleanup/+server.ts
import { json, error } from '@sveltejs/kit';
import { cleanupExpiredSessions } from '$lib/server/jobs/session-cleanup';

export async function GET({ request }) {
  // Verify cron secret
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    error(401, 'Unauthorized');
  }

  const result = await cleanupExpiredSessions();
  return json({ success: true, ...result });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/session-cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

## Cookie Caching Required

**Issue:** Without cookie caching, every request hits the database to validate the session.

```typescript
// SLOW - DB hit on every request
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
});

// FAST - Cached for 5 minutes
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
});
```

**Trade-off:** 5-minute delay before session revocation takes effect. Acceptable for most apps. Reduce `maxAge` for higher security.

## svelteKitHandler Doesn't Populate Locals

**Issue:** Using `svelteKitHandler` alone leaves `event.locals` empty.

```typescript
// WRONG - locals.user is always null
export const handle = svelteKitHandler({ auth });

// RIGHT - Populate locals manually
export const handle = sequence(
  svelteKitHandler({ auth }),
  async ({ event, resolve }) => {
    const session = await auth.api.getSession({
      headers: event.request.headers
    });
    event.locals.user = session?.user ?? null;
    event.locals.session = session?.session ?? null;
    return resolve(event);
  }
);
```

## useSession() SSR Leak

**Issue:** Module-level state is shared across SSR requests.

```svelte
<!-- WRONG - Security vulnerability -->
<script lang="ts">
  import { useSession } from '$lib/auth-client';

  // This is module-level - shared across all SSR requests!
  const session = useSession();
</script>
```

User A's session could leak to User B during SSR.

**Solution:** Use page data from server:

```typescript
// +layout.server.ts
export async function load({ locals }) {
  return { user: locals.user };
}
```

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  const user = $derived(page.data.user);
</script>
```

## Missing Session Indexes

**Issue:** Better Auth CLI doesn't generate indexes. Session lookups become slow at scale.

```typescript
// Add to _better-auth.ts after generation
import { index } from 'drizzle-orm/pg-core';

export const sessionUserIdx = index('session_user_id_idx').on(session.userId);
export const sessionExpiresIdx = index('session_expires_at_idx').on(session.expiresAt);
export const sessionTokenIdx = index('session_token_idx').on(session.token);
```

## Layout-Only Protection

**Issue:** Protecting only layouts can be bypassed.

```typescript
// INSUFFICIENT - Direct API access bypasses this
// src/routes/app/+layout.server.ts
if (!locals.user) redirect(303, '/login');
```

**Solution:** Protect each route individually:

```typescript
// src/routes/app/settings/+page.server.ts
if (!locals.user) redirect(303, '/login');

// src/routes/app/items/+page.server.ts
if (!locals.user) redirect(303, '/login');

// src/routes/api/items/+server.ts
if (!locals.user) error(401, 'Unauthorized');
```

## OAuth Callback URL Mismatch

**Issue:** OAuth fails with "redirect_uri mismatch" in production.

**Solution:** Configure trusted origins and correct callback URLs:

```typescript
export const auth = betterAuth({
  trustedOrigins: ['https://yourdomain.com'],
  // ...
});
```

Also ensure OAuth provider settings match:
- GitHub: `https://yourdomain.com/api/auth/callback/github`
- Google: `https://yourdomain.com/api/auth/callback/google`

## Email Verification Tokens Expire

**Issue:** Verification links expire after 24 hours by default.

**Solution:** Inform users, or extend expiration:

```typescript
export const auth = betterAuth({
  emailVerification: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
});
```
