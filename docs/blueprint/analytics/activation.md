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

The collector reads the consent tier from the `ANALYTICS_CONSENT_COOKIE` (`v10r_consent`). Two things are gated on it:

**The `_v10r_sid` session cookie** writes to terminal equipment and is not strictly necessary, so under TDDDG §25 / ePrivacy Art 5(3) it requires `analytics`-tier consent:

- `analytics` tier or higher → set/read `_v10r_sid` as before (httpOnly, secure, 30-min sliding window).
- `necessary` tier or no consent → touch no cookie, actively delete a stale one from a prior grant, and derive the session id with `deriveCookielessSessionId(visitorId)` = `hash(visitorId + UTC day)` (Plausible/Fathom pattern, rotates at UTC midnight).

Session counting therefore works at every tier — the cookieless id still groups one day's page views into one session without writing to the device.

**The HTTP referrer** is recorded only at `analytics`+ tier; below that it is dropped. Events are always written, but without referrer or a device-persisted session at `necessary`.

See [stack/capabilities/gdpr.md](../../stack/capabilities/gdpr.md#consent-gated-analytics-cookie) for the full privacy rationale.

## Daily rollup

`analyticsRollup()` at `src/lib/server/jobs/analytics-rollup.ts` aggregates **yesterday's** events into `analytics.daily_page_stats`. It runs as a scheduled background job.

Today's events exist only in the raw `analytics.events` table. They appear in the Live Activity feed immediately. They do not appear in the Traffic Trend chart until the next rollup runs (the following day).
