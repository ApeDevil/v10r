# Authentication Architecture

Session-based authentication with Drizzle ORM.

---

## Strategy

**Session-based auth** stored in PostgreSQL, validated via SvelteKit hooks.

| Component | Choice | Why |
|-----------|--------|-----|
| Sessions | Database-stored | Immediate revocation, no JWT complexity |
| Password hashing | Argon2id | OWASP recommended, memory-hard |
| OAuth | Arctic | 50+ providers, lightweight |
| Schema | Drizzle ORM | Type-safe, matches our stack |

### Lucia Status (Important)

Lucia v3 was **deprecated March 2025**. It's now a learning resource, not a library.

**What this means:**
- The `lucia` npm package is maintenance-only
- Adapters (`@lucia-auth/adapter-drizzle`) are deprecated
- Oslo and Arctic libraries continue active development
- SvelteKit CLI (`npx sv add lucia`) scaffolds the pattern without the library

**Our approach:** Follow Lucia patterns directly (simple code, no library dependency).

---

## Database Schema

### Tables

```typescript
// src/lib/server/db/schema/auth.ts
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // nanoid or cuid2
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash'), // null for OAuth-only users
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // min 40 chars
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const oauthAccounts = pgTable('oauth_accounts', {
  providerId: text('provider_id').notNull(), // 'github', 'google'
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.providerId, table.providerUserId] }),
}));
```

### Types

```typescript
// src/lib/server/db/schema/auth.ts
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
```

---

## Session Management

### Core Functions

```typescript
// src/lib/server/auth/session.ts
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_THRESHOLD = SESSION_DURATION / 2; // 15 days

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createSession(userId: string): Promise<Session> {
  const token = generateSessionToken();
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const [session] = await db
    .insert(sessions)
    .values({ id: sessionId, userId, expiresAt })
    .returning();

  return { ...session, token }; // Return token to set in cookie
}

export async function validateSession(token: string): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const result = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (result.length === 0) {
    return { session: null, user: null };
  }

  const { session, user } = result[0];

  // Expired
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  // Refresh if past threshold
  if (Date.now() >= session.expiresAt.getTime() - SESSION_REFRESH_THRESHOLD) {
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessions.id, sessionId));
    session.expiresAt = newExpiresAt;
  }

  return { session, user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };
```

### Cookie Handling

```typescript
// src/lib/server/auth/cookies.ts
import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE = 'session';

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    expires: expiresAt,
  });
}

export function deleteSessionCookie(cookies: Cookies): void {
  cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: 0,
  });
}

export function getSessionToken(cookies: Cookies): string | undefined {
  return cookies.get(SESSION_COOKIE);
}
```

---

## Password Authentication

### Hashing with Argon2id

```typescript
// src/lib/server/auth/password.ts
import { hash, verify } from '@node-rs/argon2';

const HASH_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password);
}
```

### Registration Flow

```typescript
// src/routes/auth/register/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema/auth';
import { hashPassword } from '$lib/server/auth/password';
import { createSession } from '$lib/server/auth/session';
import { setSessionCookie } from '$lib/server/auth/cookies';
import { generateId } from '$lib/server/utils';

const registerSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
});

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await superValidate(request, valibot(registerSchema));
    if (!form.valid) return fail(400, { form });

    const { name, email, password } = form.data;

    // Check existing user
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return fail(400, {
        form,
        message: 'Email already registered',
      });
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      name,
      email,
      passwordHash,
    });

    // Create session
    const session = await createSession(userId);
    setSessionCookie(cookies, session.token, session.expiresAt);

    redirect(303, '/app/dashboard');
  },
};
```

### Login Flow

```typescript
// src/routes/auth/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { verifyPassword } from '$lib/server/auth/password';
import { createSession } from '$lib/server/auth/session';
import { setSessionCookie } from '$lib/server/auth/cookies';

const loginSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.string(),
});

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await superValidate(request, valibot(loginSchema));
    if (!form.valid) return fail(400, { form });

    const { email, password } = form.data;

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    // Constant-time comparison: check password even if user doesn't exist
    const validPassword = user?.passwordHash
      ? await verifyPassword(user.passwordHash, password)
      : false;

    if (!user || !validPassword) {
      return fail(400, {
        form,
        message: 'Invalid email or password',
      });
    }

    const session = await createSession(user.id);
    setSessionCookie(cookies, session.token, session.expiresAt);

    redirect(303, '/app/dashboard');
  },
};
```

---

## OAuth Integration

### Arctic Setup

```typescript
// src/lib/server/auth/oauth.ts
import { GitHub, Google } from 'arctic';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '$env/static/private';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';

export const github = new GitHub(
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  null // no redirect URI needed for GitHub
);

export const google = new Google(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'http://localhost:5173/auth/google/callback'
);
```

### GitHub OAuth Flow

```typescript
// src/routes/auth/github/+server.ts
import { redirect } from '@sveltejs/kit';
import { generateState } from 'arctic';
import { github } from '$lib/server/auth/oauth';

export async function GET({ cookies }) {
  const state = generateState();
  const url = github.createAuthorizationURL(state, ['user:email']);

  cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  });

  redirect(302, url.toString());
}
```

```typescript
// src/routes/auth/github/callback/+server.ts
import { redirect } from '@sveltejs/kit';
import { github } from '$lib/server/auth/oauth';
import { db } from '$lib/server/db';
import { users, oauthAccounts } from '$lib/server/db/schema/auth';
import { createSession } from '$lib/server/auth/session';
import { setSessionCookie } from '$lib/server/auth/cookies';
import { generateId } from '$lib/server/utils';
import { eq, and } from 'drizzle-orm';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export async function GET({ url, cookies }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('github_oauth_state');

  if (!code || !state || !storedState || state !== storedState) {
    redirect(302, '/auth/login?error=invalid_state');
  }

  const tokens = await github.validateAuthorizationCode(code);
  const accessToken = tokens.accessToken();

  // Fetch GitHub user
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const githubUser: GitHubUser = await response.json();

  // Check for existing OAuth account
  const existingAccount = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(oauthAccounts.providerId, 'github'),
      eq(oauthAccounts.providerUserId, String(githubUser.id))
    ),
  });

  if (existingAccount) {
    // Login existing user
    const session = await createSession(existingAccount.userId);
    setSessionCookie(cookies, session.token, session.expiresAt);
    redirect(303, '/app/dashboard');
  }

  // Create new user
  const userId = generateId();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      name: githubUser.name ?? githubUser.login,
      email: githubUser.email ?? `${githubUser.id}@github.oauth`,
      avatarUrl: githubUser.avatar_url,
      emailVerified: !!githubUser.email,
    });

    await tx.insert(oauthAccounts).values({
      providerId: 'github',
      providerUserId: String(githubUser.id),
      userId,
    });
  });

  const session = await createSession(userId);
  setSessionCookie(cookies, session.token, session.expiresAt);

  redirect(303, '/app/dashboard');
}
```

---

## SvelteKit Integration

### Server Hook

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth/session';
import { getSessionToken, setSessionCookie, deleteSessionCookie } from '$lib/server/auth/cookies';

export const handle: Handle = async ({ event, resolve }) => {
  const token = getSessionToken(event.cookies);

  if (!token) {
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }

  const { session, user } = await validateSession(token);

  if (session) {
    // Refresh cookie if session was extended
    setSessionCookie(event.cookies, token, session.expiresAt);
    event.locals.user = user;
    event.locals.session = session;
  } else {
    deleteSessionCookie(event.cookies);
    event.locals.user = null;
    event.locals.session = null;
  }

  return resolve(event);
};
```

### Type Definitions

```typescript
// src/app.d.ts
import type { User, Session } from '$lib/server/db/schema/auth';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
    }
  }
}

export {};
```

### Route Protection

**Critical:** Never rely on `+layout.server.ts` for authorization. Always protect each route individually.

```typescript
// src/routes/app/+layout.server.ts
// DO NOT put auth checks here alone - they don't propagate to child routes!

// src/routes/app/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  if (!locals.user) {
    redirect(303, '/auth/login');
  }
  return { user: locals.user };
}
```

For multiple protected routes, create a helper:

```typescript
// src/lib/server/auth/guard.ts
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export function requireAuth(event: RequestEvent) {
  if (!event.locals.user) {
    redirect(303, `/auth/login?redirect=${encodeURIComponent(event.url.pathname)}`);
  }
  return event.locals.user;
}
```

```typescript
// src/routes/app/settings/+page.server.ts
import { requireAuth } from '$lib/server/auth/guard';

export async function load(event) {
  const user = requireAuth(event);
  return { user };
}
```

---

## Security

### CSRF Protection

SvelteKit's form actions are CSRF-protected by default via:
- `SameSite=Lax` cookies
- Origin header validation

No additional CSRF tokens needed for form actions.

### Rate Limiting

```typescript
// src/lib/server/auth/ratelimit.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';

export const authLimiter = new RateLimiter({
  IP: [5, '15m'], // 5 attempts per 15 minutes per IP
  IPUA: [10, '15m'], // 10 per IP + User Agent combo
});
```

```typescript
// src/routes/auth/login/+page.server.ts
import { authLimiter } from '$lib/server/auth/ratelimit';

export const actions = {
  default: async (event) => {
    if (await authLimiter.isLimited(event)) {
      return fail(429, { message: 'Too many attempts. Try again later.' });
    }
    // ... rest of login logic
  },
};
```

### Security Checklist

| Item | Implementation |
|------|----------------|
| Password hashing | Argon2id with OWASP params |
| Session storage | Database (not JWT) |
| Cookie flags | `httpOnly`, `secure`, `sameSite=lax` |
| CSRF | SvelteKit built-in |
| Rate limiting | Per-route on auth endpoints |
| Timing attacks | Constant-time password check |
| Session invalidation | On logout, password change |

---

## Logout

```typescript
// src/routes/auth/logout/+server.ts
import { redirect } from '@sveltejs/kit';
import { invalidateSession } from '$lib/server/auth/session';
import { deleteSessionCookie } from '$lib/server/auth/cookies';

export async function POST({ locals, cookies }) {
  if (locals.session) {
    await invalidateSession(locals.session.id);
  }
  deleteSessionCookie(cookies);
  redirect(303, '/');
}
```

```svelte
<!-- Logout button -->
<form method="POST" action="/auth/logout">
  <button type="submit">Logout</button>
</form>
```

---

## File Structure

```
src/
├── lib/
│   └── server/
│       ├── auth/
│       │   ├── session.ts      # Session CRUD
│       │   ├── password.ts     # Argon2id hashing
│       │   ├── cookies.ts      # Cookie helpers
│       │   ├── oauth.ts        # Arctic providers
│       │   ├── guard.ts        # Route protection
│       │   └── ratelimit.ts    # Rate limiting
│       └── db/
│           └── schema/
│               └── auth.ts     # User, session, oauth tables
├── routes/
│   ├── auth/
│   │   ├── login/+page.svelte
│   │   ├── login/+page.server.ts
│   │   ├── register/+page.svelte
│   │   ├── register/+page.server.ts
│   │   ├── logout/+server.ts
│   │   ├── github/+server.ts
│   │   └── github/callback/+server.ts
│   └── app/                    # Protected routes
│       ├── +layout.server.ts
│       └── dashboard/+page.server.ts
├── hooks.server.ts
└── app.d.ts
```

---

## Alternative: Better Auth

If you prefer a batteries-included solution, [Better Auth](https://www.better-auth.com/) is an emerging alternative with:

- Built-in rate limiting and CSRF
- Drizzle adapter
- SvelteKit handler
- More providers out of the box

```typescript
// Better Auth setup
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
});

// hooks.server.ts
export const handle = ({ event, resolve }) =>
  svelteKitHandler({ event, resolve, auth });
```

Trade-off: More abstraction, less control over internals.

---

## Summary

| What | How |
|------|-----|
| Session storage | PostgreSQL via Drizzle |
| Password hashing | Argon2id (`@node-rs/argon2`) |
| OAuth | Arctic (GitHub, Google, etc.) |
| Session validation | `hooks.server.ts` |
| Route protection | Per-route in `+page.server.ts` |
| CSRF | SvelteKit built-in |
| Rate limiting | `sveltekit-rate-limiter` |

---

## Related

- [database.md](./database.md) - Full schema including users, sessions, oauth_accounts tables
- [api.md](./api.md) - Protected API endpoints, rate limiting patterns
- [pages.md](./pages.md) - Auth routes (`/auth/*`) and protected routes (`/app/*`)

---

## Sources

- [Lucia Documentation (Learning Resource)](https://lucia-auth.com/)
- [Lucia v3 Archive](https://v3.lucia-auth.com/)
- [The Copenhagen Book](https://thecopenhagenbook.com/)
- [SvelteKit Auth Docs](https://svelte.dev/docs/kit/auth)
- [Svelte CLI - Lucia](https://svelte.dev/docs/cli/lucia)
- [Arctic OAuth Library](https://arctic.js.org/)
- [Oslo Crypto Utilities](https://oslo.js.org/)
- [Better Auth](https://www.better-auth.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
