# Authentication

Session-based authentication following Lucia patterns.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Auth | **DIY Sessions** | Lucia patterns, no library dependency |
| Sessions | PostgreSQL-backed | Persistent, immediate revocation |
| Password | **Argon2id** | OWASP recommended, memory-hard |
| OAuth | **Arctic** | 50+ providers, lightweight |
| Middleware | SvelteKit hooks | Native request interception |

## Lucia Status

**Lucia v3 was deprecated March 2025.** It's now a learning resource, not a maintained library.

What this means:
- The `lucia` npm package is maintenance-only
- Adapters (`@lucia-auth/adapter-drizzle`) are deprecated
- **Oslo** and **Arctic** libraries continue active development
- SvelteKit CLI (`npx sv add lucia`) scaffolds the pattern without the library

**Our approach:** Follow Lucia's session patterns directly with simple code.

## Why DIY Sessions (Lucia Patterns)

| Aspect | DIY Sessions | Clerk | Supabase Auth |
|--------|--------------|-------|---------------|
| Cost | Free forever | Free to 10K MAU | Tied to Supabase |
| Vendor Lock-in | None | High | High |
| Data Ownership | 100% yours | Third-party | Third-party |
| Drizzle Integration | Native | N/A | N/A |
| Maintenance | You own it | Managed | Managed |

DIY wins: zero cost at scale, full data control, native Drizzle, no vendor lock-in.

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

## Sessions

| Feature | Implementation |
|---------|----------------|
| Storage | PostgreSQL via Drizzle |
| Cookie | HTTP-only, secure, SameSite=Lax |
| Expiry | 30 days, refreshed at 15 days |
| Hashing | SHA-256 (token → session ID) |
| Invalidation | Logout, password change |

## Middleware

Handle auth in `hooks.server.ts`:

1. Read session cookie
2. Hash token, lookup in database
3. Validate expiry, refresh if needed
4. Attach user to `event.locals`
5. Protect routes per-route (not layout)

## Protected Routes

| Strategy | Use Case |
|----------|----------|
| Per-route `load` | **Recommended** - explicit protection |
| Helper function | `requireAuth(event)` for consistency |
| Form actions | Before mutations |
| API routes | Check `locals.user` |

**Important:** Don't rely on layout `load` for auth - protect each route individually.

## Libraries

| Package | Purpose |
|---------|---------|
| `@oslojs/crypto` | SHA-256 hashing |
| `@oslojs/encoding` | Base32/Hex encoding |
| `@node-rs/argon2` | Password hashing |
| `arctic` | OAuth providers |

## Related

See [blueprint/auth.md](../blueprint/auth.md) for full implementation details.
