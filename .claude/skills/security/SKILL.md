---
name: security
description: Security patterns for Velociraptor stack. Use when implementing authentication, handling user input, writing database queries, configuring headers, or deploying to Vercel. Covers SvelteKit CSRF, Better Auth gotchas, Drizzle/Neo4j injection, serverless security, and rate limiting. Essential for any security-sensitive code.
---

# Security

Defense-in-depth security patterns for the Velociraptor stack. Focuses on commonly misunderstood vulnerabilities and post-training knowledge gaps.

## Contents

- [Critical Gotchas](#critical-gotchas) - Must-know vulnerabilities
- [SvelteKit CSRF](#sveltekit-csrf) - Built-in protection and gaps
- [Server-Only Code](#server-only-code) - Preventing secret leaks
- [Better Auth Security](#better-auth-security) - Known vulnerabilities, rate limiting
- [SQL Injection (Drizzle)](#sql-injection-drizzle) - Safe and unsafe patterns
- [Cypher Injection (Neo4j)](#cypher-injection-neo4j) - Parameterization limits
- [Input Validation](#input-validation) - Valibot + sanitization
- [CSP Headers](#csp-headers) - SvelteKit configuration
- [Rate Limiting](#rate-limiting) - sveltekit-rate-limiter patterns
- [Serverless Security](#serverless-security) - Vercel/Neon concerns
- [Dependency Audit](#dependency-audit) - Bun security
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Detailed guides

| Threat | Primary Defense | Secondary Defense |
|--------|-----------------|-------------------|
| CSRF | SvelteKit origin check | Custom token for JSON APIs |
| SQL Injection | Drizzle parameterization | Never use `sql.raw()` with user input |
| XSS | Svelte auto-escaping | DOMPurify for `{@html}` |
| Session Hijacking | Better Auth httpOnly cookies | Short session expiry |
| DoS | Rate limiting | Connection pooling |

## Critical Gotchas

**These will break your security if you don't know them:**

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| JSON API CSRF | Built-in protection only covers forms | Add custom CSRF header check |
| Better Auth rate limiting | Broken if IP headers spoofable | Configure `ipAddressHeaders` for Vercel |
| `sql.raw()` in Drizzle | Direct SQL injection | Never use with user input |
| Neo4j dynamic labels | Cannot parameterize labels | Sanitize or restructure query |
| `{@html}` in Svelte | XSS vulnerability | Use DOMPurify |
| Bun < 1.1.30 | Prototype pollution CVE | Upgrade immediately |

## SvelteKit CSRF

### Built-in Protection

SvelteKit validates origin headers automatically in production:
- Covers `POST`, `PUT`, `PATCH`, `DELETE`
- Only for form-like content types
- **Does NOT protect JSON APIs**

```javascript
// svelte.config.js
export default {
  kit: {
    csrf: {
      checkOrigin: true // Keep enabled (default)
    }
  }
};
```

### JSON API Protection (Required)

```typescript
// src/hooks.server.ts
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Protect JSON API mutations
  if (event.request.method !== 'GET' &&
      event.request.headers.get('content-type')?.includes('application/json')) {

    const csrfHeader = event.request.headers.get('x-csrf-token');
    if (!csrfHeader) {
      error(403, 'CSRF token required');
    }
  }

  return resolve(event);
};
```

```typescript
// Client-side fetch wrapper
async function secureFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'x-csrf-token': '1', // Simple presence check
    },
  });
}
```

### Past CVE (Fixed)

**CVE-2023-29003**: CSRF bypass via uppercase `Content-Type` or `text/plain`. Fixed in SvelteKit 1.15.1+.

## Server-Only Code

### Three Protection Mechanisms

```typescript
// 1. Private env (build error if imported client-side)
import { SECRET_KEY } from '$env/static/private';

// 2. .server.ts suffix
// src/lib/secrets.server.ts
export const API_KEY = process.env.SECRET_KEY;

// 3. $lib/server/ directory
// src/lib/server/db.ts
export const db = drizzle(connection);
```

**All three cause build errors if imported in client code.**

## Better Auth Security

### Known Vulnerabilities (Monitor!)

| CVE | Severity | Description | Status |
|-----|----------|-------------|--------|
| GHSA-99h5-pjcv-gr6v | High | Unauthenticated API Key Creation | Oct 2025 |
| GHSA-vp58-j275-797x | High | trustedOrigins Bypass → ATO | Feb 2025 |
| GHSA-hjpm-7mrm-26w8 | High | Open Redirect via Callback | Feb 2025 |

**Action:** Always use latest version. Monitor [Better Auth Security Advisories](https://github.com/better-auth/better-auth/security).

### Rate Limiting Configuration

```typescript
// src/lib/server/auth.ts
export const auth = betterAuth({
  advanced: {
    // CRITICAL: Match your infrastructure
    ipAddressHeaders: ['x-forwarded-for'], // Vercel
    // ipAddressHeaders: ['cf-connecting-ip'], // Cloudflare
  },

  rateLimit: {
    window: 60,
    max: 10,
  },
});
```

**Warning:** If users can spoof IP headers, rate limiting is completely bypassed.

### Session Security

```typescript
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (reduce for sensitive apps)
    updateAge: 60 * 60 * 24,     // Extend daily

    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Revalidate every 5 min
    },
  },
});
```

## SQL Injection (Drizzle)

### Safe Pattern (Parameterized)

```typescript
import { sql } from 'drizzle-orm';

const userId = req.params.id; // User input

// Automatic parameterization
const result = await db.execute(
  sql`SELECT * FROM ${users} WHERE ${users.id} = ${userId}`
);
// Generates: SELECT * FROM "users" WHERE "users"."id" = $1
```

### Query Builder (Always Safe)

```typescript
await db.select()
  .from(users)
  .where(eq(users.id, userId)); // Parameterized
```

### DANGEROUS: sql.raw()

```typescript
// NEVER use sql.raw() with user input
const result = await db.execute(
  sql.raw(`SELECT * FROM users WHERE id = ${userId}`) // VULNERABLE
);
```

**Only use `sql.raw()` for trusted, pre-constructed SQL strings.**

## Cypher Injection (Neo4j)

### What Can Be Parameterized

| Element | Parameterizable | Example |
|---------|-----------------|---------|
| Literals | Yes | `$userId` |
| Property values | Yes | `SET n.name = $name` |
| Labels | **NO** | `:User` cannot be `$label` |
| Relationship types | **NO** | `-[:KNOWS]-` cannot be `$type` |

### Safe Pattern

```typescript
const session = driver.session();

await session.run(
  'MATCH (u:User {id: $userId}) RETURN u',
  { userId: userInput }
);
```

### Dynamic Labels (Dangerous)

```typescript
// VULNERABLE - cannot parameterize labels
const label = req.params.type;
await session.run(`MATCH (n:${label}) RETURN n`); // Injection risk

// SAFE - restructure to use properties
await session.run(
  'MATCH (n) WHERE n.type = $type RETURN n',
  { type: userInput }
);
```

### If Dynamic Labels Unavoidable

```typescript
function sanitizeIdentifier(input: string): string {
  return input.replace(/[^a-zA-Z0-9_]/g, '');
}

const sanitized = sanitizeIdentifier(userInput);
await session.run(`MATCH (n:\`${sanitized}\`) RETURN n`);
```

## Input Validation

### Valibot for Structure

```typescript
import * as v from 'valibot';

const UserInput = v.object({
  email: v.pipe(v.string(), v.email()),
  bio: v.pipe(v.string(), v.maxLength(500)),
});
```

### XSS Prevention

```svelte
<!-- SAFE - auto-escaped -->
<p>{userInput}</p>

<!-- DANGEROUS - unescaped HTML -->
<p>{@html userInput}</p>
```

### If You Must Allow HTML

```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(userInput);
```

```svelte
<div>{@html sanitized}</div>
```

## CSP Headers

```javascript
// svelte.config.js
export default {
  kit: {
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'], // Required for Svelte transitions
        'img-src': ['self', 'data:', 'https:'],
        'connect-src': ['self'],
      },
    },
  },
};
```

### Using Nonces

```html
<!-- src/app.html -->
<script nonce="%sveltekit.nonce%">
  // Inline script with nonce
</script>
```

## Rate Limiting

Better Auth rate limiting is unreliable. Use `sveltekit-rate-limiter`:

```bash
bun add sveltekit-rate-limiter
```

```typescript
// src/routes/api/login/+server.ts
import { RateLimiter } from 'sveltekit-rate-limiter/server';

const limiter = new RateLimiter({
  IP: [10, 'h'],      // 10/hour per IP
  IPUA: [5, 'm'],     // 5/min per IP+UA
});

export async function POST(event) {
  const status = await limiter.check(event);

  if (status.limited) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': status.retryAfter.toString() },
    });
  }

  // Process request
}
```

### Correct IP Detection for Vercel

```typescript
const limiter = new RateLimiter({
  IP: [10, 'h'],
  getIP: (event) => event.getClientAddress(), // Vercel-provided
});
```

## Serverless Security

### Vercel Sensitive Environment Variables

```bash
# Create sensitive variable (cannot be decrypted after)
vercel env add SECRET_KEY production --sensitive
```

### Neon Connection Limits

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL, {
  fetchConnectionCache: true, // Reuse connections
});
```

**DoS Risk:** Each serverless instance creates connections. Under load, you can exhaust the pool.

## Dependency Audit

### Check for Vulnerabilities

```bash
bun audit
bun audit fix
```

### Critical: Bun Version

```bash
# CVE-2024-21548 (Prototype Pollution) fixed in 1.1.30
bun --version  # Must be >= 1.1.30
bun upgrade
```

## Anti-Patterns

**Never disable CSRF:**
```typescript
// NEVER in production
export const auth = betterAuth({
  advanced: { disableCSRFCheck: true }, // VULNERABLE
});
```

**Never trust client IP headers without validation:**
```typescript
// WRONG - users can spoof X-Forwarded-For
const ip = request.headers.get('x-forwarded-for');

// RIGHT - use platform-provided IP
const ip = event.getClientAddress(); // Vercel
```

**Never use `@html` without sanitization:**
```svelte
<!-- WRONG -->
{@html userComment}

<!-- RIGHT -->
{@html DOMPurify.sanitize(userComment)}
```

**Never mix pooled and direct Neon connections:**
```typescript
// Pooled for app traffic
const pooledUrl = process.env.DATABASE_URL; // Uses pgbouncer

// Direct only for migrations
const directUrl = process.env.DATABASE_URL_DIRECT;
```

## References

- **references/sveltekit-csrf.md** - CSRF protection details, CVE history
- **references/better-auth-vulns.md** - Known vulnerabilities, monitoring
- **references/injection.md** - SQL/Cypher injection patterns
- **references/headers.md** - CSP, security headers, CORS
- **references/rate-limiting.md** - sveltekit-rate-limiter configuration
- **references/serverless.md** - Vercel, Neon security concerns
