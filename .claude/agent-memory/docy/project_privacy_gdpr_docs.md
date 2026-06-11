---
name: project-privacy-gdpr-docs
description: where the privacy aggregator / transparency page / api-me endpoints / consent-gated cookie are documented; gdpr.md rewritten from aspirational to built-reality
metadata:
  type: project
---

GDPR/privacy feature set (landed by 2026-06-11) is documented in **`docs/stack/capabilities/gdpr.md`** — the canonical GDPR/privacy capability doc. I rewrote it whole: it was previously aspirational (planning matrices, consent-solution comparisons, "JSON download endpoint" promised but absent). Now it documents the built reality.

**Why gdpr.md (not a new doc):** it already owned the GDPR capability and listed exactly these topics (access page, export endpoint, erasure, consent). Rewriting avoided a sprawling new file. The privacy aggregator is real architecture but fits as a capabilities entry, not its own blueprint dir.

**How to apply:** future privacy/GDPR doc updates go to `gdpr.md`. Cross-refs live in:
- `codebase-organization.md` — `privacy/` domain folder entry; `api/me/` in the api-groups line; `transparency/` in feature-dirs + barrel-less-dirs lines
- `system-abstraction.md` — Layer-3 "Privacy (GDPR)" services row; App-member row updated (`privacy/` domain + `/api/me/*`); analyticsCollector middleware row #12 (consent-gated cookie clause); traced-flow #9 (count bumped Eight→Nine)
- `docs/blueprint/analytics/activation.md` — "Consent gating" section rewritten for the `_v10r_sid` cookie gating + cookieless fallback
- `docs/stack/capabilities/README.md` — gdpr.md topic-table row

Key facts (verify against code before relying):
- Aggregator = `collectUserData(userId, {currentSessionId})` → `PersonalDataReport` in `src/lib/server/privacy/report.ts`; erasure = `deleteUserData` in `privacy/mutations.ts` (just calls `deleteUser`, cascade IS the erasure).
- 5 consumers: `/app/account/data` page load, account `exportData` action, `GET /api/me/data`, `GET /api/me/data/export`, `DELETE /api/me`.
- Consent-gated cookie logic in `src/lib/server/analytics/hook.ts`; `deriveCookielessSessionId` in `analytics/consent.ts` (hash(visitorId+UTCday)). Cookie name `_v10r_sid`; consent cookie `v10r_consent` (ANALYTICS_CONSENT_COOKIE).
- First-signup redirect in `app/+layout.server.ts`; marker = `app.user_preferences.transparency_seen_at`; `consumeTransparencyMarker()` in `db/preferences/mutations.ts` (atomic INSERT…ON CONFLICT…setWhere isNull…RETURNING).

**Stale docs found, left unchanged (out of scope — pre-date the feature, need a separate broad rewrite, not a surgical edit):**
- `docs/blueprint/app-shell/user-account.md` — diverged badly: fictional `data/export/+server.ts` (real = `/api/me/data/export`), a `RateLimiter` class (real = `createLimiter`), a "Request Export"/async-pending flow (real = synchronous JSON `<a href>` download), a `delete/` route with grace period. Describes a never-built design.
- `docs/blueprint/auth.md` — fully aspirational/generic (old hooks, `bunx` migrate flow, `userProfile` table); the Art-13 login privacy link is a tiny surface not worth bolting onto this diverged doc.
- `docs/blueprint/analytics/` has NO README (only `activation.md`) — violates the nav-hub convention but creating one was out of scope.
