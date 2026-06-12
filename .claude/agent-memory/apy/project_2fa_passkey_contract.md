---
name: 2fa-passkey-contract
description: Final Phase-1/2 API contract for 2FA+passkeys on Velociraptor — verified better-auth endpoint names, mutation-wrapping decision, hook wiring, rate limits
metadata:
  type: project
---

Final contract for adding passkeys (Phase 1) + TOTP step-up (Phase 2) to Velociraptor's passwordless Better Auth. Branch `2fa`. Verified against @better-auth/passkey + twoFactor docs 2026-06-12.

**Why:** 2-round cross-agent task force; APY owns the contract surface. Login-gating (Phase 3) deferred pending better-auth PR #9278.

**How to apply:** When 2FA/passkey work resumes, this is the authoritative endpoint + wiring map. Verify package versions still match before coding.

## Verified plugin endpoints (corrects round-1 inventory)
- Passkey (pkg `@better-auth/passkey`, separate npm): `POST /api/auth/passkey/add-passkey`, `POST /sign-in/passkey`, `GET /api/auth/passkey/list-user-passkeys`, `POST /api/auth/passkey/delete-passkey`, `POST /api/auth/passkey/update-passkey`. Client: `authClient.passkey.addPasskey/listUserPasskeys/deletePasskey({id})/updatePasskey({id,name})`. Schema fields camelCase: id,name,publicKey,userId,credentialID,counter,deviceType,backedUp,transports,createdAt,aaguid.
- TwoFactor (in-core `better-auth/plugins`): `/two-factor/enable|disable|get-totp-uri|verify-totp|verify-otp|send-otp|generate-backup-codes|verify-backup-code`; server-only `/two-factor/view-backup-codes`. `enable()` response carries `totpURI` + `backupCodes`.

## KEY CONTRACT DECISION — mutations MUST be server-wrapped
client-direct `authClient.passkey.deletePasskey()` cannot emit our server-side `admin.audit_log` row or revoke sibling sessions. Passkey plugin has `registration.afterVerification` (name-override only, no audit point) and NO delete hook. RESOLUTION: use better-auth global `hooks.after` = `createAuthMiddleware(ctx => match ctx.path)` (runs for ALL plugin endpoints, incl /passkey/* and /two-factor/verify-totp). Inside after-hook: read `ctx.context.session`/`newSession`, `ctx.context.returned`; on success path call recordAuditEvent + session-revocation + send-auth-email + (Phase 2) stamp step-up freshness. NO custom +server.ts needed for happy path — the hook is the audit/notify chokepoint. This keeps mutations client-direct (authClient) while audit can't be skipped.

## Passwordless resolution (disputed item CLOSED)
`twoFactor({ allowPasswordless: true })` is documented + works for passwordless users (passkey/magic-link/email-OTP/OAuth) — `password` param becomes optional/ignored when user has no credential account. Our app is `emailAndPassword:{enabled:false}`, so all 2FA client calls omit password. Disable-on-password-only bug #9248: our step-up gate (verifyTotp before disable) substitutes for the missing password gate.

## Redis-vs-table for step-up freshness: APY recommends REDIS
Use existing `redis` client (src/lib/server/cache), key `stepup:${userId}`, TTL via SET EX (e.g. 300s). Contract reasons: (1) freshness is inherently ephemeral — TTL semantics are native to Redis, a table needs a cleanup job/`expiresAt` filter on every read; (2) Vercel serverless multi-instance — Upstash is the shared source of truth already used for rate-limit + circuit-breaker; a row read adds a Neon round-trip on every gated action; (3) stamp happens inside the after-hook (already async). Table only wins if step-up must appear in the GDPR data export or audit trail — if so, ALSO write an audit_log row (which we do), keeping Redis as the hot-path gate. SYS's Redis approach is the contract-correct one.

## Rate limits (per-account, keyed by userId not IP)
New limiter `ratelimit:2fa:verify` on `/two-factor/verify-totp` + `/two-factor/verify-backup-code` + `/sign-in/passkey` failures — hooks in authHandler path-check (before svelteKitHandler) keyed `event.locals.user?.id ?? clientIp`. `/two-factor/send-otp` MUST join `AUTH_CAPTCHA_GATED_PATHS` (hooks.server.ts:290) — it sends email. Existing `ratelimit:auth` (5/60s per IP) already covers all `/api/auth/*`; the per-account limiter is additive for brute-force on a known account.

## DTO for security page load (SSR, never raw row)
`{ id, name, deviceType, backedUp, createdAt(ISO), aaguidLabel? }` — NEVER publicKey/credentialID/counter/transports/aaguid-raw. List via `auth.api.listPasskeys` or domain fn in $lib/server/auth. Feature-flag passkey UI off on Vercel previews via `$env/dynamic/private` VERCEL_ENV check in the +page.server load.
