---
name: passwordless-2fa-gap
description: Structural security constraint — Better Auth twoFactor plugin gates NONE of this app's sign-in methods, and its enable/disable endpoints are password-gated; naive TOTP is both theater and un-enrollable here
metadata:
  type: project
---

App is fully passwordless: `emailAndPassword: { enabled: false }` in `src/lib/server/auth/index.ts`. Sign-in methods = GitHub OAuth, Microsoft OAuth, magic link, email OTP. No user has a password.

Two structural consequences for any 2FA/MFA work (verified 2026-06-12 via better-auth docs + issue #1279):

1. **Better Auth `twoFactor` plugin only intercepts credential endpoints** (`/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number`). NONE exist here → an enrolled 2FA user is fully signed-inable via magic link / email OTP / OAuth with no second factor. Enforcement requires CUSTOM interception on all four methods (session-withholding after-hook), or it's a bypassable lock.

2. **`/two-factor/enable|disable|generate-backup-codes` require a password** (issue #1279, open, milestone 2.x). No user has one → stock enrollment 403s for everyone. Needs custom passwordless step-up (email OTP or passkey assertion).

**Why:** Both are properties of the passwordless config, not bugs to fix once — they recur for any future MFA/factor-change feature.

**How to apply:** For any 2FA/passkey/MFA request: (a) passkeys are the coherent priority (phishing-resistant, UV = MFA-in-one-gesture, not email-recoverable — breaks the "inbox = account" equation all 4 methods share); (b) if TOTP is wanted, it's only genuinely additive on the magic-link path (email OTP + TOTP = same-inbox, near-theater; OAuth + TOTP = redundant/unverifiable IdP MFA); (c) ALWAYS verify the installed better-auth version's actual interception behavior before building — #1279 may have shipped in 2.x.

Reuse patterns: session-nuke on security-state change + `recordAuditEvent` live in `src/lib/server/auth/grants.ts` (lines 97, 131). Per-account rate limiter via `createLimiter` in `src/lib/server/api/rate-limit.ts` (Upstash, fail-closed in prod). IP correctly pinned via `x-client-ip` in `hooks.server.ts`. cookieCache maxAge = 300s (`SESSION_COOKIE_MAX_AGE`) → factor changes must hard-delete sessions to avoid 5-min stale-state window.

**Round-2 verdict resolutions (2026-06-12), the non-obvious calls:**
- **Step-up freshness store = Upstash Redis, NOT a pg table.** `src/lib/server/cache/index.ts` is `@upstash/redis` REST (remote managed store, NO in-process LRU eviction) → TTL-expiry of a `stepup:${userId}:${sessionId}` key means "freshness lapsed → DENY" = fail-CLOSED, the correct direction. Missing key can only block a gated action, never permit one. Key to sessionId (not just userId) so a parallel session can't consume another's step-up; delete the key alongside the session nuke on factor change.
- **First-passkey ADD needs NO step-up** — session was just inbox-minted; re-proving via inbox OTP is theater on the same channel. Step-up matters on DELETE, Nth-add, and any downgrade. Asymmetry: easy to strengthen, hard to weaken. Freshness window = 10min for factor-mgmt (5min ceremonies time out mid-flow).
- **aaguid PII rulings:** YES in GDPR export (owner-scoped, label + map to friendly name). NO raw aaguid in `audit_log.detail` — that field is admin-queryable AND CSV-exported wholesale (`exportAuditLogCsv`), so raw aaguids = fleet-wide fingerprint corpus; store a coarse class label instead. Passkey name in detail = YES but it's user free-text.
- **`escapeCsv` in `src/lib/server/admin/audit.ts` does NOT guard spreadsheet formula-injection (`=+-@` prefix).** Pre-existing gap; passkey names are the first user-controlled string to reach it. Patch before passkeys ship.
- **Vercel previews:** disable the passkey plugin SERVER-SIDE via env flag (endpoint→404), do NOT rely on rpID-mismatch ceremony failure (obscurity, fragile if BETTER_AUTH_URL ever set per-preview). Mirror the `emailAndPassword: { enabled: false }` posture.
- **THE CEILING:** passkeys raise the floor, not the ceiling. Inbox factors stay enabled (recovery path) → inbox compromise = full takeover regardless of passkeys. Ceiling only rises if users can opt out of inbox sign-in (future, requires ≥2 passkeys + backup codes first; NOT Phase 1).
- **R5 accepted:** ≤300s stale read-only session on NON-gated routes post-revocation. Closing it costs a per-request Neon hit (defeats cookieCache, feeds serverless DoS surface). Gated/sensitive routes re-check freshness, so accept the bounded self-healing window.

Related: [[exportData-raw-ip-leak]], [[pre-consent-sid-cookie]] (prior auth-area findings from project memory).
