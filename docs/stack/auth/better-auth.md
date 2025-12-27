# Better Auth

Session-based authentication. Better Auth chosen for production. DIY available for learning.

## Decision

| Choice | Rationale |
|--------|-----------|
| **Better Auth** | TypeScript-first, Drizzle native integration, batteries-included (2FA/passkeys/OAuth) |
| Session storage | Database (Postgres) for immediate revocation |
| No vendor lock-in | Library, not service. Data stays in your database |

## Stack Comparison

| Aspect | Better Auth | DIY | Clerk |
|--------|-------------|-----|-------|
| Cost | Free | Free | Free to 10K MAU |
| Vendor Lock-in | None | None | High |
| Data Ownership | Yours | Yours | Third-party |
| Drizzle | Native adapter | Manual | N/A |
| 2FA/Passkeys | Built-in | Manual | Built-in |
| Setup Time | Minutes | Hours | Minutes |

**Why Better Auth wins:** Zero vendor lock-in with production features. Same freedom as DIY, less code.

## Better Auth Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Auth library | Better Auth | TypeScript-first, batteries-included |
| Adapter | Drizzle | Native integration, auto-schema |
| Sessions | Database (Postgres) | Persistent, immediate revocation |
| OAuth | Built-in | 20+ providers out of the box |
| 2FA/MFA | Built-in | TOTP, WebAuthn, passkeys |
| Middleware | SvelteKit hooks | Native request interception |

**Key features:**
- Session cookie caching (reduces DB hits)
- HTTP-only, secure cookies
- Sliding window refresh (configurable)
- No JWT (database sessions only)

## DIY Alternative

For learning or maximum control. Based on [The Copenhagen Book](https://thecopenhagenbook.com/).

| Layer | Technology | Why |
|-------|------------|-----|
| Sessions | PostgreSQL | Persistent, immediate revocation |
| Password | @node-rs/argon2 | Argon2id, OWASP recommended |
| OAuth | Arctic | 50+ providers, lightweight |
| Crypto | Oslo | Token generation, runtime-agnostic |

**Trade-off:** Full control vs more code to maintain. Oslo and Arctic are actively maintained.

## Libraries

### Better Auth

| Package | Purpose |
|---------|---------|
| `better-auth` | Core auth framework |
| `better-auth/adapters/drizzle` | Database integration |
| `better-auth/svelte` | Svelte client |
| `@better-auth/cli` | Schema generation |

### DIY

| Package | Purpose |
|---------|---------|
| `@oslojs/crypto` | SHA-256 hashing |
| `@oslojs/encoding` | Base32/Hex encoding |
| `@node-rs/argon2` | Argon2id password hashing |
| `arctic` | OAuth providers |

All packages are libraries with no external service dependencies.

## Links

- [Better Auth docs](https://better-auth.com)
- [The Copenhagen Book](https://thecopenhagenbook.com)
- [Implementation guide](../../blueprint/auth.md)
