# Security

Security practices for Velociraptor.

---

## Overview

| Concern | Solution | Notes |
|---------|----------|-------|
| Authentication | Better Auth | Session-based, Postgres-backed |
| Input Validation | Valibot + Superforms | Server-side validation |
| Rate Limiting (Forms) | Superforms | Built-in IP/cookie limiter |
| Rate Limiting (Global) | Upstash / sveltekit-rate-limiter | See Rate Limiting section |
| CSRF Protection | SvelteKit | Automatic for form actions |
| XSS Prevention | Svelte | Auto-escapes by default |
| SQL Injection | Drizzle ORM | Parameterized queries |

---

## Rate Limiting

### Global Rate Limiting (Required)

> **Critical**: Better Auth's built-in rate limiting is **BROKEN** (GitHub Issue #2153). Always implement external rate limiting.

| Environment | Solution | Package |
|-------------|----------|---------|
| Production | Upstash Redis | `@upstash/ratelimit` |
| Development | In-memory | `sveltekit-rate-limiter` |

**Implementation in `hooks.server.ts`:**

```typescript
import { dev } from '$app/environment';

let rateLimiter: any;

if (dev) {
  const { RateLimiter } = await import('sveltekit-rate-limiter/server');
  rateLimiter = new RateLimiter({ IP: [100, '1m'] });
} else {
  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');
  rateLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
  });
}
```

### Form Rate Limiting (Superforms)

Superforms provides built-in rate limiting for form submissions.

| Strategy | Use Case |
|----------|----------|
| IP-based | General abuse prevention |
| IP + User Agent | Stricter per-device limits |
| Cookie-based | Persistent device tracking |

**Recommended limits:**

| Endpoint Type | Limit |
|---------------|-------|
| Login | 5 attempts / 15 min |
| Registration | 3 attempts / hour |
| Password Reset | 3 attempts / hour |
| Contact Form | 5 submissions / hour |
| API Endpoints | 100 requests / min |
| AI Chat | 20 requests / min (per user) |

---

## Authentication Flow

```
┌──────────┐    ┌─────────────┐    ┌──────────┐
│  Client  │───▶│ Better Auth │───▶│ Postgres │
└──────────┘    └─────────────┘    └──────────┘
                      │
               ┌──────┴──────┐
               │   Session   │
               │  (cookie)   │
               └─────────────┘
```

- Sessions stored in Postgres (not JWT)
- HTTP-only, secure cookies
- Session invalidation on logout
- Optional: session expiry, refresh tokens

---

## Security Headers

Recommended headers (set in `hooks.server.ts` or Vercel config):

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer info |
| `Content-Security-Policy` | (project-specific) | XSS protection |

---

## Input Validation

All user input validated server-side with Valibot:

| Layer | Validation |
|-------|------------|
| Forms | Superforms + Valibot schemas |
| API Routes | Valibot in `+server.ts` |
| URL Params | Valibot in `load` functions |

Never trust client-side validation alone.

---

## Secrets Management

| Environment | Storage |
|-------------|---------|
| Local | `.env` file (gitignored) |
| CI/CD | GitLab CI/CD Variables |
| Production | Vercel Environment Variables |

**Required secrets:**
- `DATABASE_URL` - Neon connection string
- `NEO4J_URI`, `NEO4J_PASSWORD` - Neo4j Aura credentials
- `R2_ACCESS_KEY`, `R2_SECRET_KEY` - Cloudflare R2
- `RESEND_API_KEY` - Email service
- `SENTRY_DSN` - Error tracking
