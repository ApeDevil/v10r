# Authentication

Session-based authentication with Lucia.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Auth | **Lucia** | Lightweight, session-based, Svelte-friendly |
| Sessions | PostgreSQL-backed | Persistent, secure |
| Middleware | SvelteKit hooks | Native request interception |

## Why Lucia

| Aspect | Lucia | Clerk | Supabase Auth |
|--------|-------|-------|---------------|
| Cost | Free forever | Free to 10K MAU | Tied to Supabase |
| Vendor Lock-in | None | High | High |
| Data Ownership | 100% yours | Third-party | Third-party |
| Drizzle Integration | Native | N/A | N/A |

Lucia wins: zero cost at scale, full data control, native Drizzle, no vendor lock-in, SvelteKit-first.

## Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │───▶│  Lucia   │───▶│ Postgres │
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
- Optional: expiry, refresh tokens

## Sessions

| Feature | Implementation |
|---------|----------------|
| Storage | PostgreSQL via Drizzle |
| Cookie | HTTP-only, secure, SameSite=Lax |
| Expiry | Configurable (default: 30 days) |
| Refresh | Optional sliding window |
| Invalidation | Logout, password change |

## Middleware

Handle auth in `hooks.server.ts`:

1. Read session cookie
2. Validate with Lucia
3. Attach user to `event.locals`
4. Protect routes via layout `load`

## Protected Routes

| Strategy | Use Case |
|----------|----------|
| Layout `load` | Route groups (`/app/*`) |
| Page `load` | Individual pages |
| Form actions | Before mutations |
| API routes | Check `locals.user` |
