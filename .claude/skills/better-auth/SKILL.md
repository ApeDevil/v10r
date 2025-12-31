---
name: better-auth
description: Better Auth patterns for Velociraptor. Use when implementing authentication, protecting routes, or handling sessions. Includes SvelteKit hook integration, event.locals population, route guards, and critical gotchas (broken rate limiting, session cleanup). Essential for hooks.server.ts and auth-related routes.
---

# Better Auth

Session-based auth library with Drizzle adapter. TypeScript-first, batteries-included.

## Contents

- [Critical Gotchas](#critical-gotchas) - Must-know issues before implementation
- [Server Configuration](#server-configuration) - betterAuth() setup
- [SvelteKit Hook Integration](#sveltekit-hook-integration) - Two handlers pattern
- [App.d.ts Types](#appd.ts-types) - TypeScript definitions
- [Client Configuration](#client-configuration) - createAuthClient()
- [Session Access Pattern](#session-access-pattern) - SSR-safe page data
- [Route Protection](#route-protection) - Load guards, helpers, client-side
- [Auth Forms](#auth-forms) - Login, signup with Better Auth client
- [Sign Out](#sign-out)
- [Session Cleanup (Required)](#session-cleanup-required) - Cron job setup
- [Database Schema](#database-schema) - Auto-generated tables, indexes
- [Anti-Patterns](#anti-patterns) - Common mistakes to avoid
- [File Structure](#file-structure)
- [References](#references) - Detailed guides

| Concept | Purpose |
|---------|---------|
| `betterAuth()` | Server-side auth instance |
| `createAuthClient()` | Client-side auth methods |
| `svelteKitHandler` | Route handler for auth endpoints |
| `event.locals` | Request-scoped session data |
| `auth.api.getSession()` | Get session from headers |

## Critical Gotchas

**These will break your auth if you don't know them:**

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| `svelteKitHandler` alone | Does NOT populate `event.locals` | Call `auth.api.getSession()` manually |
| Rate limiting | **BROKEN** (Issue #2153) | Use external rate limiter |
| Session cleanup | Expired sessions pile up forever | Create cron job |
| `useSession()` at module level | SSR security leak | Use page data instead |
| Cookie caching disabled | DB hit on every request | Enable `cookieCache` |

## Server Configuration

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,      // Refresh every 24h

    // CRITICAL: Avoids DB hit on every request
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Revalidate every 5 min
    },
  },
});

export type Auth = typeof auth;
```

## SvelteKit Hook Integration

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';

// 1. Handle auth API routes (/api/auth/*)
const authHandle: Handle = async ({ event, resolve }) => {
  return svelteKitHandler({ event, resolve, auth });
};

// 2. Populate event.locals (REQUIRED - svelteKitHandler doesn't do this!)
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

**Why both handlers?**
- `svelteKitHandler` only handles `/api/auth/*` endpoints
- It does NOT populate `event.locals`
- You MUST call `auth.api.getSession()` separately

## App.d.ts Types

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: import('better-auth').User | null;
      session: import('better-auth').Session | null;
    }
  }
}

export {};
```

## Client Configuration

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BASE_URL,
});

export const { signIn, signUp, signOut } = authClient;
```

## Session Access Pattern

**Use page data, NOT module-level `useSession()`:**

```typescript
// src/routes/app/+layout.server.ts
export async function load({ locals }) {
  return {
    user: locals.user,
    session: locals.session,
  };
}
```

```svelte
<!-- src/routes/app/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';

  const user = $derived(page.data.user);
  const isAuthenticated = $derived(!!user);
</script>

{#if isAuthenticated}
  <p>Welcome, {user.name}!</p>
{/if}
```

**Why not `useSession()` at module level?**
Module-level state is shared across SSR requests. User A's session could leak to User B. The `event.locals` → page data pattern is request-scoped and SSR-safe.

## Route Protection

### In Load Function (Recommended)

```typescript
// src/routes/app/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/auth/login');
  }

  return { user: locals.user };
};
```

### Reusable Helper

```typescript
// src/lib/server/auth/guard.ts
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export function requireAuth(event: RequestEvent) {
  if (!event.locals.user) {
    const returnTo = encodeURIComponent(event.url.pathname);
    redirect(303, `/auth/login?redirect=${returnTo}`);
  }
  return {
    user: event.locals.user,
    session: event.locals.session!,
  };
}
```

```typescript
// Usage in any load function
export const load: PageServerLoad = async (event) => {
  const { user } = requireAuth(event);
  return { user };
};
```

### Client-Side Guard (Fallback)

```svelte
<!-- src/routes/app/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  const user = $derived(page.data.user);

  $effect(() => {
    if (browser && !user) {
      goto('/auth/login');
    }
  });
</script>

{#if user}
  {@render children()}
{:else}
  <div>Loading...</div>
{/if}
```

**Note:** Server-side guards are preferred—they prevent rendering entirely. Client guards are fallback for SPA navigation.

## Auth Forms

Auth forms use Better Auth client directly, NOT Superforms:

```svelte
<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
  import { signIn } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit() {
    loading = true;
    error = '';

    const result = await signIn.email({ email, password });

    if (result.error) {
      error = result.error.message;
      loading = false;
      return;
    }

    goto('/app/dashboard');
  }

  async function handleOAuth(provider: 'github' | 'google') {
    await signIn.social({ provider });
  }
</script>

<form onsubmit={handleSubmit}>
  <input type="email" bind:value={email} required />
  <input type="password" bind:value={password} required />

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button disabled={loading}>
    {loading ? 'Signing in...' : 'Sign In'}
  </button>
</form>

<button onclick={() => handleOAuth('github')}>Continue with GitHub</button>
<button onclick={() => handleOAuth('google')}>Continue with Google</button>
```

## Sign Up

```svelte
<script lang="ts">
  import { signUp } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let name = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit() {
    loading = true;
    error = '';

    const result = await signUp.email({ email, password, name });

    if (result.error) {
      error = result.error.message;
      loading = false;
      return;
    }

    goto('/app/dashboard');
  }
</script>
```

## Sign Out

```svelte
<script lang="ts">
  import { signOut } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  async function handleSignOut() {
    await signOut();
    goto('/');
  }
</script>

<button onclick={handleSignOut}>Sign Out</button>
```

## Session Cleanup (Required)

Better Auth does NOT clean up expired sessions. Create a cron job:

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

  return { deleted: result.length };
}
```

```typescript
// src/routes/api/cron/session-cleanup/+server.ts
import { json, error } from '@sveltejs/kit';
import { timingSafeEqual } from 'crypto';
import { cleanupExpiredSessions } from '$lib/server/jobs/session-cleanup';

export async function GET({ request }) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  // Use timing-safe comparison to prevent timing attacks
  if (!auth ||
      auth.length !== expected.length ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
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

## Database Schema

Better Auth auto-generates tables:

```bash
bunx @better-auth/cli generate
bunx drizzle-kit migrate
```

Generated tables: `user`, `session`, `account`, `verification`

**Critical:** Add indexes manually (Better Auth doesn't):

```typescript
// In _better-auth.ts after generation
export const sessionUserIdx = index('session_user_id_idx').on(session.userId);
export const sessionExpiresIdx = index('session_expires_at_idx').on(session.expiresAt);
```

## Anti-Patterns

**Don't rely on Better Auth rate limiting:**
```typescript
// BROKEN - Does not work (GitHub Issue #2153)
export const auth = betterAuth({
  rateLimit: { window: 60, max: 10 }, // This is IGNORED
});

// Use sveltekit-rate-limiter or Upstash instead
```

**Don't use `useSession()` at module level:**
```svelte
<!-- WRONG - SSR security leak -->
<script lang="ts">
  import { useSession } from '$lib/auth-client';
  const session = useSession(); // Shared across SSR requests!
</script>

<!-- RIGHT - Use page data -->
<script lang="ts">
  import { page } from '$app/state';
  const user = $derived(page.data.user);
</script>
```

**Don't forget to populate event.locals:**
```typescript
// WRONG - svelteKitHandler alone doesn't populate locals
export const handle = svelteKitHandler({ auth });

// RIGHT - Call getSession manually
export const handle = sequence(
  svelteKitHandler({ auth }),
  async ({ event, resolve }) => {
    const session = await auth.api.getSession({ headers: event.request.headers });
    event.locals.user = session?.user ?? null;
    return resolve(event);
  }
);
```

**Don't protect only layouts:**
```typescript
// WRONG - Layout protection can be bypassed
// src/routes/app/+layout.server.ts
if (!locals.user) redirect(303, '/login');

// RIGHT - Protect each route individually
// src/routes/app/settings/+page.server.ts
if (!locals.user) redirect(303, '/login');
```

**Don't edit Better Auth generated schema:**
```typescript
// WRONG - Editing _better-auth.ts
export const user = pgTable('user', {
  customField: text('custom'), // DON'T add here!
});

// RIGHT - Extend in separate table
export const userProfile = pgTable('user_profile', {
  userId: text('user_id').primaryKey().references(() => user.id),
  customField: text('custom'),
});
```

## File Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── auth.ts           # betterAuth() instance
│   │   └── auth/
│   │       └── guard.ts      # requireAuth() helper
│   └── auth-client.ts        # createAuthClient()
├── routes/
│   ├── auth/
│   │   ├── login/+page.svelte
│   │   ├── register/+page.svelte
│   │   └── forgot-password/+page.svelte
│   └── app/                   # Protected routes
│       └── +layout.server.ts  # Load session
└── hooks.server.ts            # Auth handlers
```

## References

- **references/setup.md** - Server and client configuration details
- **references/hooks.md** - SvelteKit integration, sequence() patterns
- **references/protection.md** - Route guards, session access patterns
- **references/gotchas.md** - Broken rate limiting, session cleanup, cookie caching
- **references/2fa.md** - Two-factor authentication setup
