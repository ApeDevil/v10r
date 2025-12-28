# Better Auth

## What is it?

Framework-agnostic authentication and authorization framework for TypeScript. Provides session-based auth with database-backed sessions (or optional stateless cookies). MIT licensed, fully open source—data stays in your database.

## What is it for?

- Full-featured authentication (OAuth, email/password, magic links)
- Session management (database or stateless cookie-based)
- Two-factor authentication, passkeys, WebAuthn
- Multi-tenant applications with organizations/teams
- Enterprise SSO and custom identity providers

## Why was it chosen?

| Aspect | Better Auth | Auth.js | Lucia |
|--------|-------------|---------|-------|
| Status | Active development | Maintenance mode | Deprecated |
| Drizzle | Native adapter | Plugin | Manual |
| 2FA/Passkeys | Built-in | Manual/plugin | Manual |
| Setup time | Minutes | Minutes | Hours |
| TypeScript | Full autocomplete | Manual augmentation | Full |

**Key advantages:**
- Auth.js team joined Better Auth; new projects recommended to use Better Auth
- Lucia deprecated early 2025 ("not working" per creator)
- Native Drizzle adapter with auto-schema generation
- Built-in: 2FA (TOTP), passkeys, email verification, password reset
- 20+ OAuth providers out of the box
- Session cookie caching reduces DB hits
- No vendor lock-in, data ownership

**Project stats:** 24.5k GitHub stars, 696 contributors, 9.9k dependents

## Known limitations

**Rate limiting:**
- Requires `enabled: true` and IP forwarding in SvelteKit hooks (see blueprint/auth.md)
- In-memory storage (default) problematic in serverless/multi-instance
- Use database/Redis adapter for production
- Only applies to client-initiated requests (not server-side calls)

**Session management:**
- Stateless sessions cannot be easily revoked (requires redeploy)
- Most plugins require a database

**Ecosystem:**
- Created May 2024 (~8 months old)
- Smaller provider ecosystem than Auth.js's years of contributions
- Growing but still early-stage community

**SvelteKit-specific:**
- `svelteKitHandler` doesn't auto-populate `event.locals.user` (manual implementation needed)
- Cloudflare Workers requires explicit `/api/auth/[...betterauth]` route

## Related

- [../data/drizzle.md](../data/drizzle.md) - Database integration
- [../data/postgres.md](../data/postgres.md) - Session storage
