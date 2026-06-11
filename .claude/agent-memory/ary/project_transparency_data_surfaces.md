---
name: transparency-data-surfaces
description: The three overlapping "what data do we hold about you" surfaces and where a real cross-domain user-data aggregator should live
metadata:
  type: project
---

Three pre-existing surfaces already cover "what data does v10r hold about you", at different consent/auth layers — a proposed "transparency page after first sign-up" overlaps all three and must not become a fourth duplicate truth.

1. `src/routes/[[locale=locale]]/(public)/showcases/analytics/my-data/+page.server.ts` — ANONYMOUS, live-from-request (getClientAddress + headers + cookies), reads `$lib/server/analytics/consent` (hashVisitorId, parseConsentTier). Export/delete are toast STUBS. Analytics tier only.
2. `(public)/showcases/admin/data/+page.svelte` — pure `+page.ts`, STATIC documentation of what *could* be collected per GDPR article. No server reads.
3. `app/account/+page.server.ts` — the REAL authenticated aggregator. Reads `$lib/server/db/user` (getUserProfile/getUserAccounts/getUserSessions). `exportData` action aggregates user+accounts+sessions → JSON (GDPR Art 20 for real). `deleteAccount` → `deleteUser` cascade (Art 17). This is the canonical home for real authenticated user-data aggregation TODAY, but only reads the auth/account slice.

**Why:** `app/account` only touches `db/user`. A full mirror also wants analytics + preferences + ai + desk + notifications. No cross-domain "data-mirror" aggregator module exists yet.

**How to apply:** A real transparency aggregator that reads 6+ domains should be a thin route adapter (`app/account/+page.server.ts` actions, or a new `app/account/data` child) that fans out to each domain's existing barrel (`db/user`, `db/analytics`, `db/preferences`, `db/ai`, `desk`/`store`, `db/notifications`) — NOT a new `$lib/server/transparency/` domain that imports all of them (would create a god-module pulling every domain inward, violating DAG/barrel-only direction). The adapter is the legal aggregation point; domains stay leaves.

**Analytics blind-spot:** `src/lib/server/analytics/hook.ts:24-25` excludes BOTH `/admin` and `/app` from pageview tracking. A "live mirror" page under `/app` generates ZERO analytics rows about itself — so it can show the historical anonymous trail but cannot show "this very visit" being tracked. The honest live-this-visit demo only works on a `(public)` route (which is exactly why `my-data` is public).
