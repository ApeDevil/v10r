# Authentication

Session-based authentication with two approaches: **Better Auth** (recommended) or **DIY Sessions**.

## Stack Options

| Option | Best For | Trade-off |
|--------|----------|-----------|
| **Better Auth** | Production apps, built-in 2FA/passkeys | Library dependency |
| **DIY Sessions** | Learning, maximum control | More code to maintain |

## Recommended: Better Auth

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Auth | **Session-based auth** | Better Auth | TypeScript-first, batteries-included |
| Adapter | **ORM integration** | Drizzle | Native integration, auto-schema |
| Sessions | **Database sessions** | [Neon](./vendors.md#neon) | Persistent, immediate revocation |
| OAuth | **OAuth 2.0** | Built-in | 20+ providers out of the box |
| 2FA/MFA | **TOTP/WebAuthn** | Built-in | Passkeys, authenticator apps |
| Middleware | **Request hooks** | SvelteKit | Native request interception |

**Swappability:** Better Auth is a library, not a service. Sessions stored in your own Postgres. No vendor lock-in.

**Why Better Auth:**

| Aspect | Better Auth | DIY | Clerk |
|--------|-------------|-----|-------|
| Cost | Free | Free | Free to 10K MAU |
| Vendor Lock-in | None | None | High |
| Data Ownership | 100% yours | 100% yours | Third-party |
| Drizzle | Native adapter | Manual | N/A |
| 2FA/Passkeys | Built-in | DIY | Built-in |
| Setup Time | Minutes | Hours | Minutes |

## Alternative: DIY Sessions

For learning or maximum control. Based on patterns from [The Copenhagen Book](https://thecopenhagenbook.com/).

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Sessions | **Database sessions** | PostgreSQL | Persistent, immediate revocation |
| Password | **Argon2id hashing** | @node-rs/argon2 | OWASP recommended, memory-hard |
| OAuth | **OAuth 2.0** | Arctic | 50+ providers, lightweight |
| Crypto | **Token generation** | Oslo | Runtime-agnostic, lightweight |

**Oslo** and **Arctic** are actively maintained libraries for building custom auth.

**Swappability:** All libraries, no services. Full control over your auth implementation.

## Better Auth Setup

### Installation

```bash
bun add better-auth
```

### Configuration

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
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
});
```

### SvelteKit Integration

```typescript
// src/hooks.server.ts
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const handle = svelteKitHandler({ auth });
```

### Client

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient();
```

### Generate Schema

```bash
bunx @better-auth/cli generate
bunx drizzle-kit migrate
```

## Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │───▶│  Hooks   │───▶│ Postgres │
└──────────┘    └──────────┘    └──────────┘
                     │
              ┌──────┴──────┐
              │   Session   │
              │  (cookie)   │
              └─────────────┘
```

- Sessions in Postgres (not JWT)
- HTTP-only, secure cookies
- Invalidation on logout
- Sliding window refresh (30 days default)

## Protected Routes

| Strategy | Technology | Use Case |
|----------|------------|----------|
| Per-route `load` | SvelteKit hooks | **Recommended** - explicit protection |
| Helper function | Custom middleware | `requireAuth(event)` for consistency |
| Form actions | SvelteKit actions | Before mutations |
| API routes | Request validation | Check session |

**Important:** Don't rely on layout `load` for auth - protect each route individually.

## Libraries

### Better Auth (Recommended)

| Package | Technology | Purpose |
|---------|------------|---------|
| `better-auth` | Auth framework | Full auth framework |
| `better-auth/adapters/drizzle` | ORM adapter | Database integration |
| `better-auth/svelte-kit` | Framework adapter | SvelteKit integration |
| `@better-auth/cli` | Code generation | Schema generation |

### DIY Sessions

| Package | Technology | Purpose |
|---------|------------|---------|
| `@oslojs/crypto` | Cryptography | SHA-256 hashing |
| `@oslojs/encoding` | Encoding | Base32/Hex encoding |
| `@node-rs/argon2` | Password hashing | Argon2id implementation |
| `arctic` | OAuth | 50+ OAuth providers |

All packages are libraries with no external service dependencies.

## Related

See [blueprint/auth.md](../blueprint/auth.md) for full implementation details.
