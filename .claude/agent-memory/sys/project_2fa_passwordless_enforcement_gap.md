---
name: project-2fa-passwordless-enforcement-gap
description: Better Auth twoFactor plugin does NOT enforce 2FA on this stack's passwordless sign-ins; enforcement must be an app-owned gate
metadata:
  type: project
---

Better Auth's `twoFactor` plugin gates **only credential endpoints** (`/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number`). This stack is 100% passwordless: `emailAndPassword.enabled = false` in `src/lib/server/auth/index.ts:50`; sign-in = GitHub/Microsoft OAuth, magic link, email OTP. **None of these produce `twoFactorRedirect` / trigger 2FA automatically.** Installing the plugin gives enrollment (TOTP/backup codes) but ZERO sign-in enforcement.

**Why:** This is silent security theater — a user enrolls in TOTP yet still signs in via magic link with no second factor. Non-obvious; the plugin "just works" on password stacks, so the gap is easy to miss.

**How to apply:** To enforce 2FA on passwordless sign-ins you must build an app-owned gate. Recommended runtime design = step-up gate in `src/routes/[[locale=locale]]/app/+layout.server.ts` (the single app chokepoint) PLUS the same check in `src/lib/server/auth/guards.ts` API guards (else `/api/*` is a bypass). This splits `locals` into two states: "authenticated" vs "2FA-cleared" — model explicitly.

Key hazards:
- **cookieCache (SESSION_COOKIE_MAX_AGE=300s, config.ts:10) serves stale "2FA-passed" state** for up to 5min if the cleared flag rides the cached session. Store the cleared flag OUTSIDE the cached session or use `disableCookieCache` on 2FA transitions. This is the #1 runtime hazard.
- Passkey sign-in creates a FULL session immediately, no partial state — treat passkey-authenticated as already-2FA-cleared.
- WebAuthn rpID/origin is host-scoped (locale path prefix irrelevant) but preview-vs-prod Vercel URLs differ → passkeys don't cross deploys; pin to canonical prod origin.

Round-2 runtime mechanics (verified against code 2026-06-12):
- **Step-up freshness state belongs in Redis, NOT the session/cookieCache.** Pattern: `redis.set(\`stepup:${userId}\`, Date.now(), { ex: TTL })` via the existing `redis` client (`src/lib/server/cache/index.ts:11`, same one rate-limit + quota use). `requireRecentTwoFactor(locals)` in `guards.ts` does a fresh `redis.get` — decoupled from the 300s cookieCache and 7-day session expiry. This is the ONLY way to read freshness without riding the stale cache or importing the auth instance.
- **`guards.ts` MUST NOT import `auth/index.ts`** (the betterAuth instance) — cycle risk, because hooks.server.ts imports guards transitively. Guards import a step-up module that imports `redis`, never `auth`. `requireRecentTwoFactor` becomes async (Redis read) — every caller must await; gate at the action/POST boundary, not just page load (a page loaded inside the window can submit outside it).
- **R5 (revoke other sessions on factor change): clone the raw `db.delete(session).where(eq(session.userId, ...))` pattern from `grants.ts:97,131`**, scoped to `ne(session.token, currentToken)`. Better Auth's `revokeOtherSessions` deletes rows but does NOT close the cookieCache window — other devices' self-signed `session_data` cookie stays valid ≤300s after their row is gone. Accept that bounded stale-READ window; the freshness gate makes it non-exploitable for gated ACTIONS (grants.ts already lives with the same window). Do NOT retune SESSION_COOKIE_MAX_AGE (issue #7607: cookieCache maxAge != session expiresIn breaks session_data regen with twoFactor plugin).
- **Passkey paths must stay OUT of `AUTH_CAPTCHA_GATED_PATHS` (hooks.server.ts:290)** — that set is email-send-only; WebAuthn has no email/ALTCHA token. Passkey calls DO ride the IP limiter (hooks.server.ts:338, `/api/auth/` prefix) and inherit x-client-ip stamping — both correct, no change needed.
- **Vercel-preview passkey flag evaluated at request time via `$env/dynamic/private`** (extend `features.ts:3-8`), surfaced to UI through a server `load()` — NEVER `$env/dynamic/public` (inlined, can't distinguish preview origin on Vercel multi-function split).
- Redis-down posture for step-up = fail-closed in prod (matches rate-limit.ts:28) — but this is a PRODUCT decision to confirm.

Related: [[project_signup_flow_no_server_hook]] (OAuth callback owned by Better Auth, no app +server seam).
