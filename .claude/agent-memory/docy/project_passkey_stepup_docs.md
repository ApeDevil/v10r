---
name: passkey-stepup-docs
description: Where the passkey + step-up-TOTP feature (branch 2fa) is documented and the honest caveats baked into those docs
metadata:
  type: project
---

Passkey + step-up-TOTP feature (landed branch `2fa`, 2026-06-12) documented across the auth doc surface.

**Why:** the feature reshaped auth — passkeys are now a phishing-resistant first factor; TOTP is a step-up factor only (never a login challenge, because Better Auth's twoFactor gates only credential sign-in and this app is passwordless).

**How to apply:** when auth docs need updating, these are the homes:
- `docs/blueprint/auth.md` — primary. New "Passkeys & Step-Up TOTP" section (anchor `#passkeys--step-up-totp`) + "Step-Up Rate Limiting" section. Replaced the old generic 2FA section. File-structure/env/summary blocks updated to real state (auth/ is a folder of modules, Microsoft not Google OAuth).
- `docs/stack/auth/better-auth.md` — vendor gotchas: twoFactor-gates-credential-only, passkeys-excluded-on-`*.vercel.app`-previews (Public Suffix List vs rpID), no `/passkey/add-passkey` endpoint in 1.6.17.
- `docs/stack/data/drizzle.md` — "Better Auth adapter: model→table by export-const name" rule (camelCase `export const passkey`/`twoFactor` mandatory; SQL names free snake_case).
- `docs/system-abstraction.md` — flow #8 + Layer 6 step-up gate note.
- `docs/codebase-organization.md` — auth/ folder line (step-up.ts, factor-changes.ts) + schema/auth asymmetry row (db/user now has passkey read DTOs).
- `docs/stack/capabilities/gdpr.md` — privacy report `security` section is contract/never-portable; REPORT_SCHEMA_VERSION bumped 2026-06-12.
- README topic tables synced: `docs/blueprint/README.md`, `docs/stack/auth/README.md`.

**Honest caveat documented (don't soften it):** magic link / email OTP stay enabled as recovery, so inbox control still equals account control. Passkeys raise the floor, not the ceiling.

**Out of scope, no home:** `escapeCsv` formula-injection hardening in admin/audit.ts — the audit/CSV-export surface is undocumented in live docs (only `docs/.archive/`), so no natural place to record it. Skipped rather than forcing a home.

Related: [[privacy-gdpr-docs]]
