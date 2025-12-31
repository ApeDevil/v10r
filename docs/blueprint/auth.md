# Authentication Architecture

**Passwordless** session-based authentication using Better Auth with Drizzle ORM.

**Technology:** Session-based auth (library, not a service). See [stack/auth.md](../../stack/auth.md) for alternatives.

> **No passwords.** Users authenticate via magic link or OTP code (both sent in one email). This eliminates password-related security risks and simplifies the auth flow.

---

## Strategy

**Better Auth** for production-ready passwordless authentication.

| Component | Technology | Provider | Why |
|-----------|------------|----------|-----|
| Framework | Session auth | Better Auth | TypeScript-first, batteries-included |
| Primary auth | Magic link + OTP | Built-in plugins | No passwords to breach |
| Adapter | ORM integration | Drizzle | Native integration, auto-schema |
| Sessions | Database sessions | [Neon](../../stack/vendors.md#neon) | Immediate revocation, no JWT complexity |
| 2FA | TOTP | Built-in | Layer on top of passwordless |
| OAuth | OAuth 2.0 | Built-in | 20+ providers supported |

### Why Passwordless

| Concern | Password-based | Passwordless |
|---------|----------------|--------------|
| Credential stuffing | Vulnerable | Immune |
| Weak passwords | Common problem | Non-issue |
| Password reuse | Major risk | Non-issue |
| Database breach impact | High (hashes leaked) | Low (no secrets) |
| User friction | Forgot password flow | Just request new link |
| Support burden | Password resets | Minimal |

### Why Better Auth

| Feature | Better Auth | DIY | Clerk |
|---------|-------------|-----|-------|
| Setup time | Minutes | Hours | Minutes |
| Magic link + OTP | Built-in plugins | Manual | Built-in |
| Drizzle adapter | Native | Manual | N/A |
| Cost | Free | Free | $25/mo after 10K |
| Vendor lock-in | None | None | High |

---

## Dependencies

```json
"better-auth": "^1.x"
```

> See [development-environment.md](./development-environment.md) for installation workflow.

---

## Server Configuration

### Auth Instance

> **Important:** Better Auth has TWO separate plugins for passwordless auth:
> - `magicLink` — generates a clickable URL with 32-char token
> - `emailOTP` — generates an independent 6-digit code
>
> We use BOTH plugins together and send both in the same email.

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { db } from './db';
import { sendAuthEmail } from './email';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),

  // NO emailAndPassword - we use magic link + OTP only
  emailAndPassword: {
    enabled: false,
  },

  // Rate limiting (emailOTP plugin doesn't accept rateLimit directly)
  // See: https://github.com/better-auth/better-auth/issues/3848
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
    customRules: {
      '/sign-in/magic-link': { window: 300, max: 5 },  // 5 per 5 min
      '/sign-in/email-otp': { window: 300, max: 5 },   // 5 per 5 min
      '/email-otp/verify-email': { window: 60, max: 5 }, // 5 per min (verification)
    },
  },

  plugins: [
    // Magic Link plugin - for clickable email links
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Generate OTP via the emailOTP plugin
        // The OTP is stored separately with its own expiration
        const otpResult = await auth.api.sendVerificationOtp({
          body: { email, type: 'sign-in' },
        });

        // Send email with BOTH magic link AND OTP code
        await sendAuthEmail({
          to: email,
          subject: 'Sign in to Velociraptor',
          magicLinkUrl: url,
          otpCode: otpResult.otp!, // Only available if sendVerificationOTP returns it
        });
      },
      storeToken: 'hashed', // CRITICAL: Hash tokens before storage
      expiresIn: 600, // 10 minutes
    }),

    // Email OTP plugin - for 6-digit codes
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes (same as magic link)
      allowedAttempts: 3, // Lock out after 3 failed attempts per code
      sendVerificationOTP: async ({ email, otp, type }) => {
        // Email is sent from magicLink.sendMagicLink above
        // This callback is for standalone OTP (we don't use it directly)
        // Return the OTP so sendMagicLink can include it
        return { otp };
      },
    }),
  ],

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
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes - revalidate session from DB every 5 min
    },
  },
});

export type Auth = typeof auth;
```

> **Security notes:**
> - `storeToken: 'hashed'` — Magic link tokens are hashed before storage (database breach doesn't expose active links)
> - `allowedAttempts: 3` — OTP codes are invalidated after 3 failed attempts (per-code lockout)
> - `customRules` — Rate limiting per endpoint prevents brute force
> - Magic link and OTP are **cryptographically independent** — compromising one doesn't reveal the other

### Auth Email Template

```typescript
// src/lib/server/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface AuthEmailParams {
  to: string;
  subject: string;
  magicLinkUrl: string;
  otpCode: string;
}

export async function sendAuthEmail({ to, subject, magicLinkUrl, otpCode }: AuthEmailParams) {
  await resend.emails.send({
    from: 'Velociraptor <auth@yourdomain.com>',
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2>Sign in to Velociraptor</h2>

        <p>Click the button to sign in instantly:</p>
        <a href="${magicLinkUrl}"
           style="display: inline-block; background: #000; color: #fff;
                  padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Sign In
        </a>

        <p style="margin-top: 24px; color: #666;">
          Or enter this code:
        </p>
        <div style="font-size: 32px; font-family: monospace; letter-spacing: 4px;
                    background: #f5f5f5; padding: 16px; text-align: center;">
          ${otpCode}
        </div>

        <p style="margin-top: 24px; font-size: 14px; color: #999;">
          This link and code expire in 10 minutes.
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
```

> **Email scanner note:** Some enterprise email systems (Microsoft Defender, etc.) prefetch URLs which can "consume" magic links before users click them. The OTP code provides a reliable fallback. See [GitHub #5550](https://github.com/better-auth/better-auth/issues/5550).

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
import { magicLinkClient } from 'better-auth/client/plugins';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BASE_URL,
  plugins: [
    magicLinkClient(),  // For magic link sign-in
    emailOTPClient(),   // For OTP verification
  ],
});

// Export typed helpers
export const {
  signIn,
  signOut,
  useSession,
  emailOtp,  // For OTP verification: emailOtp.verifyOtp()
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

> **Passwordless only.** No passwords in the system. Users authenticate via:
> 1. **Magic link** — Click link in email, instant sign in
> 2. **OTP code** — Enter 6-digit code from email
> 3. **OAuth** — GitHub, Google, etc.
>
> Both magic link and OTP are sent in the same email. User chooses their preferred method.

### Email Entry (Step 1)

```svelte
<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
  import { authClient, signIn } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let email = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit() {
    loading = true;
    error = '';

    const result = await authClient.signIn.magicLink({
      email,
      callbackURL: '/app/dashboard',
    });

    if (result.error) {
      error = result.error.message;
      loading = false;
      return;
    }

    // Redirect to verification page
    goto(`/auth/verify?email=${encodeURIComponent(email)}`);
  }

  async function handleOAuth(provider: 'github' | 'google') {
    await signIn.social({ provider });
  }
</script>

<form onsubmit={handleSubmit}>
  <h1>Sign in</h1>

  <div class="form-field">
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      bind:value={email}
      placeholder="you@example.com"
      required
    />
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <button type="submit" disabled={loading}>
    {loading ? 'Sending...' : 'Continue with Email'}
  </button>
</form>

<div class="divider">or</div>

<div class="oauth-buttons">
  <button type="button" onclick={() => handleOAuth('github')}>
    Continue with GitHub
  </button>
  <button type="button" onclick={() => handleOAuth('google')}>
    Continue with Google
  </button>
</div>
```

### OTP Verification (Step 2)

> **Important:** OTP verification uses `emailOtp.verifyOtp()`, NOT `signIn.magicLink()`.
> Magic links and OTPs are **cryptographically independent** — different tokens, different verification methods.

```svelte
<!-- src/routes/auth/verify/+page.svelte -->
<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  const email = $derived(page.url.searchParams.get('email') ?? '');

  let code = $state('');
  let loading = $state(false);
  let error = $state('');
  let attemptsRemaining = $state(3);
  let resendCooldown = $state(0);

  async function handleVerify() {
    loading = true;
    error = '';

    // Use emailOtp.verifyOtp() - NOT signIn.magicLink()
    const result = await authClient.emailOtp.verifyOtp({
      email,
      otp: code,
    });

    if (result.error) {
      attemptsRemaining--;
      if (attemptsRemaining <= 0) {
        error = 'Too many failed attempts. Please request a new code.';
      } else {
        error = `Invalid code. ${attemptsRemaining} attempts remaining.`;
      }
      loading = false;
      return;
    }

    goto('/app/dashboard');
  }

  async function handleResend() {
    resendCooldown = 60;
    attemptsRemaining = 3; // Reset attempts on new code
    const interval = setInterval(() => {
      resendCooldown--;
      if (resendCooldown <= 0) clearInterval(interval);
    }, 1000);

    // Request new magic link (which also triggers new OTP)
    await authClient.signIn.magicLink({
      email,
      callbackURL: '/app/dashboard',
    });
  }

  // Auto-submit when 6 digits entered
  $effect(() => {
    if (code.length === 6 && !loading) {
      handleVerify();
    }
  });
</script>

<div class="verify-page">
  <h1>Check your email</h1>
  <p>We sent a sign-in link to <strong>{email}</strong></p>

  <p class="hint">Click the link in your email, or enter the 6-digit code below:</p>

  <form onsubmit={handleVerify}>
    <div class="otp-input">
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="6"
        bind:value={code}
        placeholder="000000"
        autocomplete="one-time-code"
      />
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button type="submit" disabled={loading || code.length !== 6 || attemptsRemaining <= 0}>
      {loading ? 'Verifying...' : 'Verify'}
    </button>
  </form>

  <p class="resend">
    Didn't receive it?
    {#if resendCooldown > 0}
      <span>Resend in {resendCooldown}s</span>
    {:else}
      <button type="button" onclick={handleResend}>Resend email</button>
    {/if}
  </p>
</div>
```

> **Security notes:**
> - `attemptsRemaining` tracks client-side attempts (UX feedback only)
> - Server-side `allowedAttempts: 3` in emailOTP config enforces the real limit
> - After 3 failed attempts, the OTP is invalidated — user must request a new code

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

## Security

### Built-in Protections

| Feature | Status |
|---------|--------|
| CSRF protection | Forms only (see warning below) |
| Session fixation | Handled |
| Secure cookies | Default in production |
| Magic link expiry | 10 minutes (configurable) |
| Rate limiting | Requires config (see below) |
| Session revocation | `revokeOtherSessions: true` |

> **CSRF Warning**: SvelteKit's built-in CSRF protection only covers form submissions (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`). **JSON API endpoints are NOT protected.** For any `+server.ts` endpoints that accept `application/json` and mutate data, you must implement one of:
>
> 1. **Custom header check** (simplest):
>    ```typescript
>    // In +server.ts
>    if (!request.headers.get('x-requested-with')) {
>      return json({ error: 'Missing CSRF header' }, { status: 403 });
>    }
>    ```
>    Client must send: `fetch(url, { headers: { 'x-requested-with': 'fetch' } })`
>
> 2. **Double Submit Cookie** - generate token in hook, validate in endpoint
> 3. **Use form actions instead** - covered by SvelteKit's automatic protection

### Rate Limiting

> **Important**: Better Auth's rate limiting requires specific configuration to work in SvelteKit. Issues #2153, #2112, #1891 documented problems that are now resolved with proper setup.

**Requirements for Better Auth rate limiting:**
1. Explicitly set `enabled: true`
2. Forward client IP in hooks (SvelteKit doesn't expose it automatically)
3. Use database/Redis storage in production (in-memory fails in serverless)
4. Only applies to client-initiated requests (not server-side calls)

```typescript
// src/hooks.server.ts - Forward client IP
const authHandle = async ({ event, resolve }) => {
  // Required: Better Auth needs client IP for rate limiting
  event.request.headers.set('x-client-ip', event.getClientAddress());

  const authResponse = await svelteKitHandler({ auth, event });
  if (authResponse) return authResponse;
  // ...
};

// src/lib/server/auth.ts
export const auth = betterAuth({
  rateLimit: {
    enabled: true, // Required: must be explicit
    window: 60,
    max: 10,
    storage: 'database', // For production: use 'database' or Redis
  },
});
```

**For additional protection** - see [rate-limiting.md](./rate-limiting.md) for sveltekit-rate-limiter (defense in depth) and Upstash (distributed limiting).


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

> **Security:** Use timing-safe comparison for cron secrets to prevent timing attacks.

```typescript
// src/routes/api/cron/session-cleanup/+server.ts
import { json, error } from '@sveltejs/kit';
import { timingSafeEqual } from 'crypto';
import { CRON_SECRET } from '$env/static/private';
import { cleanupExpiredSessions } from '$lib/server/jobs/session-cleanup';

function verifyCronSecret(authHeader: string | null): boolean {
  if (!authHeader || !CRON_SECRET) {
    return false;
  }

  const expected = `Bearer ${CRON_SECRET}`;

  // Length check first
  if (authHeader.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET({ request }) {
  const auth = request.headers.get('authorization');

  if (!verifyCronSecret(auth)) {
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
│   │   ├── auth.ts           # Better Auth instance (magic link + OTP)
│   │   ├── email.ts          # Auth email sender
│   │   └── auth/
│   │       └── guard.ts      # Route protection helper
│   └── auth-client.ts        # Client-side auth (signIn, signOut)
├── routes/
│   ├── auth/
│   │   ├── login/+page.svelte    # Email entry
│   │   └── verify/+page.svelte   # OTP verification
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
| Primary auth | Magic link + OTP (passwordless) |
| Session storage | PostgreSQL via Drizzle |
| OAuth providers | GitHub, Google (built-in) |
| 2FA | TOTP plugin (optional layer) |
| Route protection | Per-route in `+page.server.ts` |
| Session access | `event.locals` → page data (SSR-safe) |

---

## Alternative: DIY Sessions

For learning or maximum control, see [The Copenhagen Book](https://thecopenhagenbook.com/) and use:

| Package | Purpose |
|---------|---------|
| `@oslojs/crypto` | SHA-256 hashing (for tokens) |
| `@oslojs/encoding` | Base32/Hex encoding |
| `arctic` | OAuth providers |

This approach requires implementing sessions, cookies, magic link flows, and OAuth manually.

---

## Related

- [../foundation/user-data.md](../foundation/user-data.md) - Data category definitions
- [db/README.md](./db/README.md) - Data layer overview
- [db/relational.md](./db/relational.md) - Schema including Better Auth tables
- [api.md](./api.md) - Protected API endpoints
- [pages.md](./pages.md) - Auth routes (`/auth/*`) and protected routes (`/app/*`)

---

## Sources

- [Better Auth Documentation](https://www.better-auth.com/)
- [Better Auth SvelteKit Integration](https://www.better-auth.com/docs/integrations/svelte-kit)
- [Better Auth Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [The Copenhagen Book](https://thecopenhagenbook.com/)
- [SvelteKit Auth Docs](https://svelte.dev/docs/kit/auth)
