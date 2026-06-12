---
name: auth-2fa-passkey-placement
description: Canonical homes for 2FA/passkey work + corrections to assumptions about the auth source tree (schema is domain-foldered, security mgmt already lives in app/account)
metadata:
  type: project
---

Placement decisions for adding passkeys + 2FA (Better Auth 1.6.x, passwordless stack). Phased: P1 passkey-only, P2 TOTP step-up, P3 (deferred) login-gating.

**Why:** Better Auth `twoFactor` plugin does NOT gate any of v10r's 4 sign-in methods (OAuth/magic-link/OTP) — v1.6.3 added full-path gating, 1.6.4 reverted it (issue #9552). Passkey-first is the security consensus; TOTP only as opt-in step-up. Login-gating waits on upstream PR #9278 / issue #1279.

**How to apply** — ground-truth auth source tree (round-1 assumptions were WRONG, verified 2026-06-12):
- Better Auth **config/plugins** live in `src/lib/server/auth/index.ts` (NOT a `_better-auth.ts` config file — that name is the schema table-defs file).
- Schema is **domain-foldered**: `db/schema/auth/{_better-auth.ts, grant.ts, grant-request.ts}` + per-domain `index.ts` barrel + central `db/schema/relations.ts`. Each plugin table = its own concept-named file (`passkey.ts`, `two-factor.ts`), re-exported from the barrel. `_better-auth.ts` is reserved for the 4 adapter-coupled core tables (user/session/account/verification) and is the ONLY place a column on `user` (e.g. `twoFactorEnabled`) may be added.
- All tables use `authSchema.table(...)` from `pgSchema('auth')` — NOT public schema. `_better-auth.ts` siblings use no `withTimezone`; `grant.ts` does — match the adapter-expectation neighbor.
- **Security management already exists** at `app/account/+page.server.ts` (form actions: sessions, linked accounts, exportData, deleteAccount) + `+page.svelte`. NO `account/security/` route, NO `_sections/`, NOT Superforms. Extend this page inline; only split when it overflows.
- Authenticated area is the plain `app/` segment (NOT `(app)` group), guarded by `app/+layout.server.ts` → `requireAuth(locals,...)`.
- Route naming: kebab full words everywhere, zero abbreviations — BUT P3 challenge route resolved to `auth/2fa/` (svey's call; "2FA" is the surface term), mirroring `auth/verify`. Deferred — do not scaffold.

Canonical homes (confirmed correct from round 1): tunables/feature-flags → `config.ts` (interpret `$env` once, consume by name); locals-only step-up predicate → `auth/guards.ts`; rate limiter → `api/rate-limit.ts` `createLimiter` (per-account = key arg, not new file); audit events → `admin/audit.ts` `recordAuditEvent`; auth email template → `auth/send-auth-email.ts` (one `xTemplate()` per type); factor DTO query → `db/user/queries.ts`; GDPR exposure → `privacy/report.ts` security section + bump `REPORT_SCHEMA_VERSION`. Passkey npm package is `@better-auth/passkey` (separate) + `@simplewebauthn/*` pinned via `package.json` overrides — package boundary ≠ file boundary, schema placement unaffected.

Import-direction guard: `privacy/report.ts` reads ONLY `$lib/server/db/*` (its stated single-sink rule) — factor DTOs must reach it via `db/user`, never via `auth/`, to avoid a cross-domain edge.

Related: [[transparency-data-surfaces]] (the privacy aggregator this extends).
