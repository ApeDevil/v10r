# Better Auth

Session-based auth, database-backed via the native Drizzle adapter. This app is **passwordless** — OAuth (Google) + magic link + OTP, with passkeys for phishing-resistant login and TOTP as step-up only. See the `better-auth` skill and [blueprint/auth.md](../../blueprint/auth.md).

## Why was it chosen?

- Native Drizzle adapter with auto-schema generation.
- Built-in passkeys and TOTP — both load-bearing for this app's auth model.

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
- **`/api/auth/*` is fully owned by `svelteKitHandler`'s catch-all.** Any custom `+server.ts` routes placed under this prefix are silently swallowed — Better Auth handles the request and returns a 404 before SvelteKit's router sees it. Custom API routes that happen to start with `/api/auth/` (e.g. grant requests) must be moved to a different prefix (e.g. `/api/grant-requests`).

**twoFactor gates credential sign-in only:**
- The `twoFactor` plugin's challenge fires **only** on `/sign-in/email|username|phone-number`. A passwordless app (OAuth + magic link + OTP) has no credential sign-in, so a TOTP login challenge never triggers — by upstream design (1.6.3 broadened the gating, 1.6.4 reverted it). This app uses **passkeys** for phishing-resistant login and TOTP purely as a **step-up** factor. `allowPasswordless: true` lets credential-less users still enroll TOTP. Disabling TOTP / regenerating backup codes are gated upstream on a password we don't have ([#9248](https://github.com/better-auth/better-auth/issues/9248)); we substitute a step-up-freshness check in a `hooks.before` middleware. See [blueprint/auth.md](../../blueprint/auth.md#passkeys--step-up-totp).

**Passkeys break on shared-domain previews:**
- `*.vercel.app` is on the Public Suffix List, so a Vercel preview URL can never satisfy the production `rpID`. The passkey plugin is **excluded entirely** on previews (`VERCEL_ENV === 'preview'`) — endpoints 404, UI hidden via an exported `passkeysEnabled` flag — rather than shipping a half-working ceremony surface.

**Plugin endpoint shapes (1.6.19):**
- Passkey registration is two calls — `GET /passkey/generate-register-options` then `POST /passkey/verify-registration` (no `/passkey/add-passkey` endpoint). The client `addPasskey()` wraps both.
- `@better-auth/passkey` is a peer that must match `better-auth` version-for-version; both are pinned exact.
- Pinned at `1.6.19` (bumped from `1.6.17`) for the upstream OTP-replay and session-cookie-splitting fixes.

**Secure cookies set explicitly:**
- `advanced.useSecureCookies = NODE_ENV === 'production'` rather than relying on Better Auth inferring it from the baseURL scheme. The scheme-inference path is fragile behind a proxy (the app sees `http` internally while serving `https`); pinning it to `NODE_ENV` is deterministic.

## Related

- [../data/drizzle.md](../data/drizzle.md) - Database integration
- [../data/postgres.md](../data/postgres.md) - Session storage
