# Analytics Collector — Active

## Status: active

`analyticsCollector` is wired into the `sequence(...)` in `src/hooks.server.ts` at the final position in the chain.

**Full sequence:**

```
securityHeaders → loadStyle → i18n → authHandler → sessionPopulate
→ csrfProtection → consentLoader → debugOwnerLoader → routeGuard
→ analyticsCollector
```

`debugOwnerLoader` (position 8) verifies the `v10r_debug_owner` HMAC cookie and populates `event.locals.debugOwnerId`. This runs before `analyticsCollector` so the collector can attribute events to a paired admin session without requiring the phone to be logged in.

`analyticsCollector` runs last — after route guards — so it only records requests that have fully resolved through auth and routing.

## What it writes

- `analytics.events` — one row per pageview, with path, referrer, consent tier, and `debug_owner_id` if a debug cookie is present.
- `analytics.sessions` — one row per visitor session; updated on each event with last-seen timestamp. Tagged with `paired_admin_user_id` and `paired_at` when the session is paired.

## Consent gating

The collector reads `event.locals.consentTier` (set by `consentLoader` from the `ANALYTICS_CONSENT_COOKIE`). Visitors with only the `necessary` tier have their `sessionFragment` and device fingerprint suppressed — no PII is recorded. Events are still written, but as unlinked rows with no visitor identity.

## Daily rollup

`analyticsRollup()` at `src/lib/server/jobs/analytics-rollup.ts` aggregates **yesterday's** events into `analytics.daily_page_stats`. It runs as a scheduled background job.

Today's events exist only in the raw `analytics.events` table. They appear in the Live Activity feed immediately. They do not appear in the Traffic Trend chart until the next rollup runs (the following day).
