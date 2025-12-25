# Authentication Architecture

Session-based authentication using Better Auth with Drizzle ORM.

**Technology:** Session-based auth (library, not a service). See [stack/auth.md](../../stack/auth.md) for alternatives.

---

## Strategy

**Better Auth** for production-ready features with minimal setup.

| Component | Technology | Provider | Why |
|-----------|------------|----------|-----|
| Framework | Session auth | Better Auth | TypeScript-first, batteries-included |
| Adapter | ORM integration | Drizzle | Native integration, auto-schema |
| Sessions | Database sessions | [Neon](../../stack/vendors.md#neon) | Immediate revocation, no JWT complexity |
| 2FA | TOTP | Built-in | No additional libraries |
| OAuth | OAuth 2.0 | Built-in | 20+ providers supported |

### Why Better Auth

| Feature | Better Auth | DIY | Clerk |
|---------|-------------|-----|-------|
| Setup time | Minutes | Hours | Minutes |
| 2FA/Passkeys | Built-in | Manual | Built-in |
| Drizzle adapter | Native | Manual | N/A |
| Cost | Free | Free | $25/mo after 10K |
| Vendor lock-in | None | None | High |

---

## Installation

```bash
bun add better-auth
```

---

## Server Configuration

### Auth Instance

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
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    // CRITICAL: Enable cookie caching to avoid DB hit on every request
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes - revalidate session from DB every 5 min
    },
  },
});

export type Auth = typeof auth;
```

### SvelteKit Hook

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';

// Better Auth handler
const authHandle = async ({ event, resolve }) => {
  return svelteKitHandler({ event, resolve, auth, building });
};

// Populate event.locals with session (optional but recommended)
const sessionHandle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;
  return resolve(event);
};

// Compose handlers with sequence (add more handlers as needed)
// See api.md for CORS handler example
export const handle = sequence(authHandle, sessionHandle);
```

**Why `sequence`?** SvelteKit only allows one `handle` export. Use `sequence` from `@sveltejs/kit/hooks` to compose multiple handlers (auth, CORS, logging, etc.).

---

## Client Configuration

### Auth Client

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BASE_URL,
});

// Export typed helpers
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
```

### Session Access Pattern

**Primary pattern:** Access session via `event.locals` (populated in hooks) and page data.

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
<script>
  import { page } from '$app/state';

  const user = $derived(page.data.user);
  const isAuthenticated = $derived(!!page.data.user);
</script>

{#if isAuthenticated}
  <p>Welcome, {user.name}!</p>
{/if}
```

**Why not module-level `useSession()`?** Module-level state is shared across SSR requests, creating a security risk where User A's session could leak to User B. The `event.locals` pattern is request-scoped and SSR-safe. See [state.md](./state.md#better-auth-session-state) for details.

---

## Database Schema

Better Auth auto-generates tables. Run CLI to create migrations:

```bash
bunx @better-auth/cli generate
bunx drizzle-kit migrate
```

### Generated Tables

```typescript
// Better Auth creates these tables automatically:
// - user (id, email, emailVerified, name, image, createdAt, updatedAt)
// - session (id, userId, token, expiresAt, ipAddress, userAgent)
// - account (id, userId, providerId, providerUserId, accessToken, refreshToken)
// - verification (id, identifier, value, expiresAt)
```

### Extending the Schema

```typescript
// src/lib/server/db/schema/auth.ts
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// Better Auth's user table (reference only - generated by CLI)
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Your custom user fields (separate table)
export const userProfile = pgTable('user_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  website: text('website'),
  timezone: text('timezone').default('UTC'),
});
```

---

## Authentication Flows

> **Why not Superforms?** Auth forms use Better Auth's client methods (`signIn.email()`, `signUp.email()`) directly instead of Superforms + Valibot. This is intentional:
>
> 1. **Client-side auth flow** — Better Auth handles validation, rate limiting, and error messages internally
> 2. **No server action needed** — Auth endpoints are managed by `svelteKitHandler`, not form actions
> 3. **Built-in features** — OAuth redirects, email verification, and 2FA work out of the box
>
> For all other forms (profile, settings, CRUD), use Superforms + Valibot as documented in [forms.md](./forms.md).

### Sign Up

```svelte
<!-- src/routes/auth/register/+page.svelte -->
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

    const result = await signUp.email({
      email,
      password,
      name,
    });

    if (result.error) {
      error = result.error.message;
      loading = false;
      return;
    }

    goto('/app/dashboard');
  }
</script>

<form onsubmit={handleSubmit}>
  <input type="text" bind:value={name} placeholder="Name" required />
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Password" required />

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button type="submit" disabled={loading}>
    {loading ? 'Creating account...' : 'Sign Up'}
  </button>
</form>
```

### Sign In

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

    const result = await signIn.email({
      email,
      password,
    });

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
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Password" required />

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button type="submit" disabled={loading}>
    {loading ? 'Signing in...' : 'Sign In'}
  </button>
</form>

<div class="oauth-buttons">
  <button onclick={() => handleOAuth('github')}>Continue with GitHub</button>
  <button onclick={() => handleOAuth('google')}>Continue with Google</button>
</div>
```

### Sign Out

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

---

## Route Protection

### Server-Side (Recommended)

```typescript
// src/routes/app/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

export async function load({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    redirect(303, '/auth/login');
  }

  return {
    user: session.user,
  };
}
```

### Helper Function

```typescript
// src/lib/server/auth/guard.ts
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export async function requireAuth(event: RequestEvent) {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (!session) {
    const returnTo = encodeURIComponent(event.url.pathname);
    redirect(303, `/auth/login?redirect=${returnTo}`);
  }

  return session;
}
```

```typescript
// src/routes/app/settings/+page.server.ts
import { requireAuth } from '$lib/server/auth/guard';

export async function load(event) {
  const { user } = await requireAuth(event);
  return { user };
}
```

### Client-Side Guard

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
  <slot />
{:else}
  <div>Loading...</div>
{/if}
```

**Note:** Server-side guards (in `+page.server.ts`) are preferred — they prevent the page from rendering at all. Client-side guards are a fallback for SPA navigation.

---

## Two-Factor Authentication

### Enable 2FA Plugin

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';

export const auth = betterAuth({
  // ... base config
  plugins: [
    twoFactor({
      issuer: 'Velociraptor',
    }),
  ],
});
```

### 2FA Setup Flow

```svelte
<!-- src/routes/app/settings/2fa/+page.svelte -->
<script lang="ts">
  import { authClient } from '$lib/auth-client';

  let qrCode = $state('');
  let secret = $state('');
  let code = $state('');
  let enabled = $state(false);

  async function generateSecret() {
    const result = await authClient.twoFactor.generate();
    if (result.data) {
      qrCode = result.data.qrCode;
      secret = result.data.secret;
    }
  }

  async function enable2FA() {
    const result = await authClient.twoFactor.enable({ code });
    if (!result.error) {
      enabled = true;
    }
  }
</script>

{#if !enabled}
  <button onclick={generateSecret}>Setup 2FA</button>

  {#if qrCode}
    <img src={qrCode} alt="2FA QR Code" />
    <p>Secret: {secret}</p>
    <input type="text" bind:value={code} placeholder="Enter code" />
    <button onclick={enable2FA}>Enable 2FA</button>
  {/if}
{:else}
  <p>2FA is enabled</p>
{/if}
```

---

## Password Reset

```typescript
// src/routes/auth/forgot-password/+page.server.ts
import { auth } from '$lib/server/auth';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email') as string;

    await auth.api.forgetPassword({
      body: { email, redirectTo: '/auth/reset-password' },
    });

    return { success: true };
  },
};
```

```typescript
// src/routes/auth/reset-password/+page.server.ts
import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request, url }) => {
    const data = await request.formData();
    const password = data.get('password') as string;
    const token = url.searchParams.get('token');

    if (!token) {
      return { error: 'Invalid reset link' };
    }

    await auth.api.resetPassword({
      body: { newPassword: password, token },
    });

    redirect(303, '/auth/login?reset=success');
  },
};
```

---

## Security

### Built-in Protections

| Feature | Status |
|---------|--------|
| CSRF protection | Automatic |
| Session fixation | Handled |
| Secure cookies | Default in production |
| Password hashing | bcrypt (configurable) |
| Rate limiting | **BROKEN** - use external (see below) |
| Session revocation | `revokeOtherSessions: true` |

### Rate Limiting

> **Critical**: Better Auth's built-in rate limiting is **BROKEN** (GitHub Issue #2153). Do NOT rely on it.

```typescript
// BROKEN - DO NOT USE
export const auth = betterAuth({
  rateLimit: { window: 60, max: 10 }, // This does NOT work!
});
```

**Use external rate limiting instead** - see [security.md](../security.md#rate-limiting) for implementation with Upstash (production) or sveltekit-rate-limiter (development).

### Custom Password Hashing

```typescript
// src/lib/server/auth.ts
import { hash, verify } from '@node-rs/argon2';

export const auth = betterAuth({
  // ... config
  advanced: {
    customPassword: {
      hash: (password) => hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      }),
      verify: (hash, password) => verify(hash, password),
    },
  },
});
```

### Session Cleanup (Required)

> **Important**: Better Auth does NOT automatically clean up expired sessions. Without cleanup, your session table will grow indefinitely.

**Create a cleanup job:**

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

**Create a cron endpoint:**

```typescript
// src/routes/api/cron/session-cleanup/+server.ts
import { json, error } from '@sveltejs/kit';
import { cleanupExpiredSessions } from '$lib/server/jobs/session-cleanup';

export async function GET({ request }) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    error(401, 'Unauthorized');
  }

  const result = await cleanupExpiredSessions();
  return json({ success: true, ...result });
}
```

**Schedule in `vercel.json`:**

```json
{
  "crons": [{
    "path": "/api/cron/session-cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

---

## File Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── auth.ts           # Better Auth instance
│   │   └── auth/
│   │       └── guard.ts      # Route protection helper
│   └── auth-client.ts        # Client-side auth (signIn, signUp, signOut)
├── routes/
│   ├── auth/
│   │   ├── login/+page.svelte
│   │   ├── register/+page.svelte
│   │   ├── forgot-password/+page.svelte
│   │   └── reset-password/+page.svelte
│   └── app/                  # Protected routes
│       ├── +layout.server.ts # Load session from event.locals
│       ├── +layout.svelte    # Client guard (fallback)
│       └── dashboard/
│           └── +page.server.ts
└── hooks.server.ts           # Better Auth handler + session population
```

---

## Environment Variables

```bash
# .env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
VITE_BASE_URL=http://localhost:5173
```

---

## Summary

| What | How |
|------|-----|
| Auth framework | Better Auth |
| Session storage | PostgreSQL via Drizzle |
| OAuth providers | GitHub, Google (built-in) |
| 2FA | TOTP plugin |
| Route protection | Per-route in `+page.server.ts` |
| Session access | `event.locals` → page data (SSR-safe) |

---

## Alternative: DIY Sessions

For learning or maximum control, see [The Copenhagen Book](https://thecopenhagenbook.com/) and use:

| Package | Purpose |
|---------|---------|
| `@oslojs/crypto` | SHA-256 hashing |
| `@oslojs/encoding` | Base32/Hex encoding |
| `@node-rs/argon2` | Password hashing |
| `arctic` | OAuth providers |

This approach requires implementing sessions, cookies, and OAuth flows manually.

---

## Related

- [db/README.md](./db/README.md) - Data layer overview
- [db/postgres.md](./db/postgres.md) - Schema including Better Auth tables
- [api.md](./api.md) - Protected API endpoints
- [pages.md](./pages.md) - Auth routes (`/auth/*`) and protected routes (`/app/*`)

---

## Sources

- [Better Auth Documentation](https://www.better-auth.com/)
- [Better Auth SvelteKit Integration](https://www.better-auth.com/docs/integrations/svelte-kit)
- [Better Auth Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [The Copenhagen Book](https://thecopenhagenbook.com/)
- [SvelteKit Auth Docs](https://svelte.dev/docs/kit/auth)
