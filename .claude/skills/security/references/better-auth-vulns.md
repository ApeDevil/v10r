# Better Auth Vulnerabilities

## Known Vulnerabilities (2024-2025)

Better Auth has had several security advisories. **Always use the latest version.**

### High Severity

| ID | Date | Description |
|----|------|-------------|
| GHSA-99h5-pjcv-gr6v | Oct 2025 | Unauthenticated API Key Creation through api keys plugin |
| GHSA-vp58-j275-797x | Feb 2025 | trustedOrigins Bypass leads to Account Takeover |
| GHSA-hjpm-7mrm-26w8 | Feb 2025 | Open Redirect via Scheme-Less Callback Parameter |

### Moderate Severity

| ID | Date | Description |
|----|------|-------------|
| GHSA-36rg-gfq2-3h56 | Jul 2025 | Open Redirect in originCheck Middleware |
| GHSA-9x4v-xfq5-m8x5 | Feb 2025 | URL parameter HTML Injection (Reflected XSS) |
| GHSA-8jhw-6pjj-8723 | Dec 2024 | Open Redirect in Verify Email Endpoint |

## Monitoring

**GitHub Security Advisories:** https://github.com/better-auth/better-auth/security

**Recommended:** Set up GitHub notifications for this repository.

## Rate Limiting Issues

### The Problem

Better Auth's built-in rate limiting can be bypassed if IP headers are spoofable.

### Vercel Configuration

```typescript
// src/lib/server/auth.ts
export const auth = betterAuth({
  advanced: {
    // Vercel sets x-forwarded-for from edge
    ipAddressHeaders: ['x-forwarded-for'],
  },

  rateLimit: {
    window: 60,   // 1 minute window
    max: 10,      // 10 requests per window
    storage: 'memory', // or 'database' for distributed
  },
});
```

### Cloudflare Configuration

```typescript
export const auth = betterAuth({
  advanced: {
    ipAddressHeaders: ['cf-connecting-ip'],
  },
});
```

### Testing Rate Limit Effectiveness

```bash
# Should get blocked after 10 requests
for i in {1..15}; do
  curl -X POST https://yourapp.com/api/auth/sign-in/email \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -w "\n%{http_code}\n"
done
```

## Security Configuration Checklist

```typescript
export const auth = betterAuth({
  // Database
  database: drizzleAdapter(db, { provider: 'pg' }),

  // Session security
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days max
    updateAge: 60 * 60 * 24,      // Refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,             // Revalidate every 5 min
    },
  },

  // CRITICAL: Never disable in production
  advanced: {
    disableCSRFCheck: false,      // Keep CSRF enabled
    ipAddressHeaders: ['x-forwarded-for'], // Match your infra
  },

  // Email verification
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },

  // Rate limiting
  rateLimit: {
    window: 60,
    max: 10,
  },
});
```

## Session Cleanup

Better Auth does NOT automatically clean up expired sessions.

```typescript
// src/lib/server/jobs/session-cleanup.ts
import { db } from '$lib/server/db';
import { session } from '$lib/server/db/schema';
import { lt } from 'drizzle-orm';

export async function cleanupExpiredSessions() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1); // 24h grace

  await db.delete(session).where(lt(session.expiresAt, cutoff));
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

## Trusted Origins Attack (GHSA-vp58-j275-797x)

### The Vulnerability

Attackers could bypass `trustedOrigins` validation through URL manipulation.

### Mitigation

1. Update to latest Better Auth version
2. Minimize `trustedOrigins` list
3. Never use wildcard patterns

```typescript
// WRONG - too permissive
trustedOrigins: ['*.example.com']

// RIGHT - explicit origins only
trustedOrigins: ['https://app.example.com', 'https://admin.example.com']
```

## Open Redirect Prevention

### The Vulnerabilities

Multiple CVEs related to open redirects in:
- Callback parameters
- Email verification endpoints
- originCheck middleware

### Mitigation

1. Update to latest version
2. Validate all redirect URLs server-side
3. Only allow redirects to same-origin or explicitly allowed origins

```typescript
// Custom redirect validation
function isAllowedRedirect(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://yourapp.com');
    return parsed.origin === 'https://yourapp.com';
  } catch {
    return false;
  }
}
```
