# Setup

Complete Better Auth configuration for Velociraptor.

## Contents

- [Installation](#installation)
- [Server Instance](#server-instance) - betterAuth config
- [Client Instance](#client-instance) - createAuthClient
- [Environment Variables](#environment-variables)
- [Schema Generation](#schema-generation) - CLI and migrations
- [Custom Password Hashing](#custom-password-hashing) - Argon2id
- [Cookie Configuration](#cookie-configuration) - Prefix, secure
- [Trusted Origins](#trusted-origins) - Production domains
- [Type Exports](#type-exports) - User, Session types

## Installation

```bash
bun add better-auth
```

## Server Instance

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';

export const auth = betterAuth({
  // Database
  database: drizzleAdapter(db, { provider: 'pg' }),

  // Email/Password auth
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false, // Set true in production
  },

  // OAuth providers
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

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days in seconds
    updateAge: 60 * 60 * 24,      // Refresh session every 24h

    // CRITICAL: Enable cookie caching
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes
    },
  },

  // Email configuration (for verification, password reset)
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Integrate with your email provider
      await sendEmail({
        to: user.email,
        subject: 'Verify your email',
        html: `<a href="${url}">Verify email</a>`,
      });
    },
  },

  // Advanced options
  advanced: {
    // Custom password hashing (optional)
    // customPassword: { hash, verify }
  },
});

export type Auth = typeof auth;
```

## Client Instance

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
  $fetch,
} = authClient;
```

## Environment Variables

```bash
# .env
DATABASE_URL=postgres://...
VITE_BASE_URL=http://localhost:5173

# OAuth providers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cron secret for session cleanup
CRON_SECRET=your_random_secret
```

## Schema Generation

Better Auth auto-generates database tables:

```bash
# Generate schema file
bunx @better-auth/cli generate

# Apply migrations
bunx drizzle-kit migrate
```

This creates:
- `user` - User accounts
- `session` - Auth sessions
- `account` - OAuth provider links
- `verification` - Email/password tokens

### Schema File Location

```typescript
// src/lib/server/db/schema/_better-auth.ts
// AUTO-GENERATED - do not edit manually
// Re-run `bunx @better-auth/cli generate` after Better Auth updates
```

The underscore prefix indicates auto-generated file.

## Custom Password Hashing

Replace bcrypt with Argon2id:

```typescript
// src/lib/server/auth.ts
import { hash, verify } from '@node-rs/argon2';

export const auth = betterAuth({
  // ... other config

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

## Cookie Configuration

```typescript
export const auth = betterAuth({
  // ... other config

  advanced: {
    cookiePrefix: 'velociraptor',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
});
```

## Trusted Origins

For production with custom domains:

```typescript
export const auth = betterAuth({
  // ... other config

  trustedOrigins: [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
  ],
});
```

## Type Exports

```typescript
// Re-export types for use elsewhere
export type { User, Session } from 'better-auth';
```
