---
name: gdpr-data-surface
description: Existing GDPR/transparency surfaces (account exportData/deleteAccount form actions, analytics my-data showcase) and the gap a /api/me/data contract would fill
metadata:
  type: project
---

A "transparency data mirror" (first-signup page showing all collected user data) is under brainstorm. The contract landscape already has partial, inconsistent GDPR pieces — a new `GET /api/me/data` should UNIFY them, not add a fourth divergent surface.

**Existing pieces (verified 2026-06-11):**
- `src/routes/[[locale=locale]]/app/account/+page.server.ts` — form actions `exportData` (returns `JSON.stringify` of profile+accounts+sessions ONLY — 3 of ~12 domains, no versioning, no envelope), `deleteAccount` (confirmation==='DELETE' → `deleteUser` cascade), `revokeSession`. This is the de-facto Art-15/17 surface today and it is INCOMPLETE.
- `src/routes/[[locale=locale]]/(public)/showcases/analytics/my-data/+page.server.ts` — anonymous-visitor mirror (load-only, NO userId, NO db reads). Shows hashed visitorId, masked IP, UA, consent tier. Keyed by IP+UA hash, not user.id.
- `docs/stack/capabilities/gdpr.md` — claims a `/account/data` page + "JSON download endpoint" exist. They DO NOT (vaporware doc). Lists Art-15 access / Art-20 export / Art-17 erasure / 30-day deadline as requirements.
- `src/lib/server/db/user/` — `getUserProfile`, `getUserAccounts`, `getUserSessions`, `deleteUser`. The reusable domain layer. Missing: preferences, AI conversations, desk files, notifications links, blog comments, feedback, palettes, analytics-by-user, audit logs.

**Why:** v10r multi-client-core = one domain fn powers every surface; shape mismatch between surfaces is a bug. The export form action and a future AI `get_my_data` tool and the mirror page must all serialize from ONE `collectUserData(userId)` domain fn. See [[admin-json-endpoint-conventions]].

**How to apply:** Recommend a single `$lib/server/privacy/` (or `gdpr/`) domain module: `collectUserData(userId): UserDataExport` (versioned DTO, grouped by domain) + `deleteUserData(userId)`. REST `GET /api/me/data` — note: codebase has NO `/api/v1/` prefix (verified 2026-06-11; all routes are unversioned `/api/...`), so version lives in DTO `meta.schemaVersion`, NOT the URL. Envelope `{data}`, `setHeaders` no-store/private, rate-limit via `createLimiter('rl:me-data', ...)`+`rateLimitResponse(reset)` (already emits 429+Retry-After). Endpoints: `GET /api/me/data` (paginated peek), `GET /api/me/data/export` (full download, `Content-Disposition: attachment`), `DELETE /api/me` (Art-17, idempotent → 204). PAGINATION REALITY: user-facing listings (`/api/ai/conversations`) use OFFSET (`parsePagination` → `{data:{items,meta,pagination}}`), NOT cursor — match that for the conversations sub-listing to stay consistent; cursor helpers exist but aren't the user-facing default. The mirror page `+page.server.ts` calls the same `collectUserData`. AI tool later wraps it read-only with userId closure-captured (search-catalog.ts pattern: `risk`/`scope` meta, structured return, never throw). Auth via `requireApiUser(locals)` (throws `apiError(401)` Response). The KEY tension: linking the anonymous pre-signup analytics trail (hashed visitorId) to the new account is privacy-sensitive and not cleanly keyed by user.id — keep that domain SEPARATE/best-effort, never block the export on it. Also: `account` exportData LEAKS raw `getUserSessions` shape (unmasked ip/ua) straight into JSON — rewrite it to call `collectUserData` so DTO mapping/masking is enforced in one place.
