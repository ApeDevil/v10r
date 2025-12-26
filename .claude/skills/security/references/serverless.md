# Serverless Security

## Vercel Environment Variables

### Sensitive Variables (2024 Feature)

Vercel now supports sensitive environment variables that:
- Cannot be decrypted after creation
- Are only decrypted at build/runtime
- Should be used for ALL secrets

```bash
# Create sensitive variable
vercel env add DATABASE_URL production --sensitive
vercel env add BETTER_AUTH_SECRET production --sensitive
vercel env add CRON_SECRET production --sensitive
```

### Migration from Legacy Secrets

Legacy `@secret-name` syntax was deprecated May 2024. Update `vercel.json`:

```json
// OLD (deprecated)
{
  "env": {
    "DATABASE_URL": "@database-url"
  }
}

// NEW
{
  "env": {
    "DATABASE_URL": "${DATABASE_URL}"
  }
}
```

### Variable Access

```typescript
// Server-side only
const dbUrl = process.env.DATABASE_URL;

// Never expose to client
// WRONG: VITE_DATABASE_URL (prefixed vars go to client)
```

### Size Limits

Environment variables now support 64KB (increased from 5KB).

## Neon PostgreSQL Security

### Connection Pooling (PgBouncer)

Neon provides built-in connection pooling:

```
postgresql://user:pass@endpoint.neon.tech/db           # Direct
postgresql://user:pass@endpoint-pooler.neon.tech/db   # Pooled
```

**Use pooled connections for app traffic:**
```typescript
// .env
DATABASE_URL=postgresql://...@endpoint-pooler.neon.tech/db
DATABASE_URL_DIRECT=postgresql://...@endpoint.neon.tech/db
```

```typescript
// src/lib/server/db.ts
import { neon } from '@neondatabase/serverless';

// Use pooled for application queries
export const db = neon(process.env.DATABASE_URL);
```

```typescript
// migrations/run.ts
// Use direct for migrations only
const migrationDb = neon(process.env.DATABASE_URL_DIRECT);
```

### Connection Limits

| Tier | Pooled Connections | Direct Connections |
|------|-------------------|-------------------|
| Free | ~100 | ~20 |
| Scale | ~10,000 | Configurable |

### DoS via Connection Exhaustion

**Problem:** Each serverless instance creates new connections. Under heavy load:
1. Connection pool exhausts
2. New requests fail
3. Cascading failures

**Mitigation:**

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL, {
  fetchConnectionCache: true, // Reuse connections
});
```

### Prepared Statements in Pooled Mode

PgBouncer transaction mode doesn't support some features:

```typescript
// FAILS in pooled mode
await sql`SELECT pg_advisory_lock(123)`;

// FAILS in pooled mode
await sql`PREPARE stmt AS SELECT * FROM users WHERE id = $1`;

// WORKS - client library handles preparation
await sql`SELECT * FROM users WHERE id = ${userId}`;
```

## Cold Start Security

### Secrets in Memory

Secrets loaded during cold start persist in function memory:

```typescript
// SECURE - loaded once at cold start
const apiKey = process.env.API_KEY;

export async function handler() {
  // Uses cached apiKey
}
```

**Risk:** Memory can persist between invocations. Don't store user-specific secrets.

### Timing Attacks

Cold starts have variable timing. Don't use timing for security decisions:

```typescript
// VULNERABLE to timing attacks
if (userInput === secretToken) {
  // Comparison time reveals string length
}

// SAFE - constant-time comparison
import { timingSafeEqual } from 'crypto';

const equal = timingSafeEqual(
  Buffer.from(userInput),
  Buffer.from(secretToken)
);
```

## Function Security

### Execution Limits

| Setting | Value | Security Implication |
|---------|-------|---------------------|
| Max duration | 60s (Pro: 300s) | DoS protection |
| Memory | 1024MB default | Resource exhaustion |
| Payload | 4.5MB | Upload attacks |

### Cron Job Authentication

```typescript
// src/routes/api/cron/cleanup/+server.ts
import { error, json } from '@sveltejs/kit';

export async function GET({ request }) {
  // Verify Vercel cron header
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    error(401, 'Unauthorized');
  }

  // Run cron job
  return json({ success: true });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

### Edge vs Serverless

| Aspect | Edge | Serverless |
|--------|------|------------|
| Location | CDN nodes | Regional |
| Cold start | Faster | Slower |
| APIs | Limited (no Node.js) | Full Node.js |
| Secrets | Same access | Same access |

**Security recommendation:** Use edge for rate limiting, serverless for database operations.

## OIDC Token (Advanced)

Vercel provides OIDC tokens for backend auth without storing credentials:

```typescript
export async function GET({ request }) {
  const oidcToken = request.headers.get('x-vercel-oidc-token');

  // Use for AWS/GCP/Azure authentication
  // Token is signed by Vercel, can be verified by cloud provider
}
```

## Logging Security

### Don't Log Secrets

```typescript
// WRONG
console.log('Auth attempt:', { email, password });

// RIGHT
console.log('Auth attempt:', { email, passwordProvided: !!password });
```

### Vercel Log Retention

- Build logs: 7 days
- Runtime logs: Varies by plan
- Logs may be visible to team members

### Structured Logging

```typescript
import { dev } from '$app/environment';

function secureLog(event: string, data: Record<string, unknown>) {
  const sanitized = { ...data };
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;

  if (dev) {
    console.log(event, sanitized);
  } else {
    // Send to logging service
  }
}
```

## Deployment Security

### Preview Deployments

Preview deployments are public by default. Protect sensitive previews:

```json
// vercel.json
{
  "passwordProtection": {
    "deploymentType": "preview"
  }
}
```

### Branch Protection

```json
// vercel.json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "develop": true
    }
  }
}
```

### Environment Separation

```bash
# Different secrets per environment
vercel env add DATABASE_URL production --sensitive
vercel env add DATABASE_URL preview --sensitive
vercel env add DATABASE_URL development --sensitive
```
