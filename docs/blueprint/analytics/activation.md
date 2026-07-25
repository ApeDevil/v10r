# Analytics Collector — Active

## Status: active

`analyticsCollector` is wired into the `sequence(...)` in `src/hooks.server.ts` at the final position in the chain.

**Full sequence:**

```
securityHeaders → stripBaseLocalePrefix → loadStyle → i18n → authCaptchaGate
→ authHandler → sessionPopulate → csrfProtection → consentLoader
→ debugOwnerLoader → devRouteGuard → analyticsCollector
```

`debugOwnerLoader` (position 10 of 12) verifies the `v10r_debug_owner` HMAC cookie and populates `event.locals.debugOwnerId`, so the collector can attribute events to a paired admin session without the phone being logged in.

`analyticsCollector` runs last — after route guards — so it only records requests that fully resolved through auth and routing.

## What it writes

The collector feeds **two lanes**; see [two-lane-model.md](./two-lane-model.md) for why they are separate and must stay that way.

**Anonymous lane** — public GET pageviews only:

- `analytics.events` — one row per pageview, with path, templated `route`, referrer, consent tier, and `debug_owner_id` when a debug cookie is present.
- `analytics.sessions` — one row per session, updated on each event.

**Authenticated lane** — `/account/*` only, and only when a session exists:

- `analytics.user_events` — keyed by `user_id`, FK-cascading to `auth.user`.

`/admin` and `/desk` are recorded by **neither** lane. Eligibility is decided in one place, `analytics/collect-policy.ts`, which both the server hook and the SPA beacon import — they previously disagreed, and client-side navigations into authenticated areas leaked into the anonymous lane as a result.

Deferred writes are wrapped in `waitUntil()` from `@vercel/functions`. This is load-bearing rather than decorative: on Vercel the function may be frozen the moment the response is returned, so a bare un-awaited promise silently loses an unbounded share of events.

## Consent gating

The collector reads the tier from `ANALYTICS_CONSENT_COOKIE` (`v10r_consent`). There are **two tiers**, `necessary` and `analytics` — a former `full` tier was removed because nothing gated on it while the banner promised it granted more (see `scripts/db/collapse-consent-tier.ts`).

**The `_v10r_sid` session cookie** writes to terminal equipment and is not strictly necessary, so under TDDDG §25 / ePrivacy Art 5(3) it needs `analytics` consent:

- `analytics` tier → set/read `_v10r_sid` (httpOnly, secure, 30-min sliding window).
- `necessary` tier → touch no cookie, actively delete a stale one from a prior grant, and derive the session id as `hash(visitorId + UTC day)` (Plausible/Fathom pattern, rotates at UTC midnight).

Session counting therefore works at both tiers without writing to the device.

**Referrer** is recorded only at the `analytics` tier.

An old `full` cookie value parses to `necessary`, not to `analytics` — the visitor consented to a description of the processing that no longer exists, so they are asked again rather than silently credited.

## Server-side enrichment

`analytics/enrich.ts` fills three columns that were previously always NULL in production. The tier split is legal, not stylistic:

- **`country`** — from `x-vercel-ip-country`, derived from the *connection* at the edge. No terminal-equipment access, so it is collected at **every tier**. Validated to `char(2)`; `ZZ` is discarded rather than stored as a country.
- **`device` + `browser`** — parsed from the User-Agent, which reports terminal configuration, so **`analytics` tier only**. Deliberately coarse: family only, never a version number. iPadOS 13+ Safari reports as Macintosh and is counted as desktop — telling it apart needs a touch-points or screen probe, which is exactly the entropy this subsystem refuses to add.

`upsertSession` backfills these when they become known mid-session, but never wipes a value already lawfully collected.

## Custom events and the cardinality budget

`analytics/event-schema.ts` is a **closed allowlist**. An event name not listed is dropped at ingest; a property key not listed for that event is stripped. Cardinality — not row count — is what kills hand-rolled analytics, and the damage is invisible until dashboards are already slow.

Two bounds:

- **Path templating at write time.** `route` stores `/blog/[slug]`, derived from SvelteKit's `event.route.id`. Aggregates group by `route`, so publishing more content cannot degrade the dashboards. `path` stays raw for detail views.
- **Declared value domains.** Enums, length caps, and integer ranges per property. Out-of-range integers are clamped rather than dropped — an outlier is still a real observation.

Allowed events: `rage_click`, `dead_click`, `scroll_depth`, `form_abandon`, `engagement`, `outbound_click`. `form_abandon` records which field was last touched and **never its content** — that is the line between behavioural data and potentially Art 9 data.

## Client telemetry

`src/lib/analytics/telemetry.ts`, ingesting at `/api/analytics/journey/collect`:

- **Web Vitals with the attribution build** — LCP, INP, CLS, TTFB, FCP, each reporting the element responsible. A bare INP number says something is slow; attribution says which button. Dynamically imported, so the larger attribution bundle never sits on the critical path.
- **Engaged time** via `visibilitychange`, not wall clock — a hidden tab contributes nothing.
- **Rage and dead clicks** — the aggregate signals session replay is normally used to hunt for, obtainable without recording anyone's screen.
- **Scroll depth**, bucketed to quartiles.
- **Uncaught errors and unhandled rejections**, message only, capped — never a stack, which can carry URLs and enclosing-scope values.

Consent is checked at push time **and re-checked on flush**, and the queue is discarded on withdrawal: a visitor who revokes mid-session must not have buffered events delivered afterwards.

The SPA beacon (`journey-beacon.ts`) handles bfcache restores via `pageshow` + `event.persisted`. Without it, back-navigation is an invisible pageview. Both it and the telemetry queue flush on `pagehide` and on `visibilitychange`, never on `unload` — registering `unload` would make the page bfcache-ineligible for no benefit. Both transports share the same ~64 KiB keepalive quota, so `fetch(keepalive)` is a fallback delivery path, not extra headroom.

## Daily rollup

`analyticsRollup()` aggregates yesterday's events into `analytics.daily_page_stats`. Both derived metrics were rewritten because both were wrong:

- **Duration** was wall-clock elapsed ÷ page count, which counts a tab left open over lunch as deep engagement. It now reads real engaged time from `engagement` events.
- **Bounce rate** was `page_count = 1`, which was doubly broken — the SPA beacon never advanced `page_count`, and a four-minute read is not a bounce. It is now a single-page session that also failed to clear a 10-second engagement threshold.

Today's events appear in the live feed immediately but not in the trend chart until the next rollup.

## Funnels

`/showcases/analytics/funnels` counts `count(distinct session_id)` per step in one grouped query. Session-level dedup means a reload mid-funnel is still counted once. The naive alternative — counting each step independently and joining — mixes cohorts across time and inflates conversion.

## Journeys

The Neo4j journey graph was **retired**: it was fed by a seed function with zero callers, so the Sankey rendered stale demo data while claiming to show real journeys. `/showcases/analytics/journeys` now computes page-to-page transitions in Postgres with a `LEAD()` window function over consecutive pageviews in a session, and reads entry/exit pages straight off `analytics.sessions`.

Presented as a ranked table rather than a flow diagram, deliberately: aggregate path diagrams merge visitors with opposite experiences into one indistinguishable ribbon, which looks explanatory without being able to answer "who, and why".

## Retention

One job, `analyticsCleanup()`, covers everything — Vercel Hobby rejects sub-daily crons and fails the *whole deployment* when it sees one, so extra retention jobs would each cost a scarce daily slot.

| Table | Window |
|---|---|
| `events`, `sessions` | 60 days |
| `user_events` | 180 days (or immediately, via FK cascade on account deletion) |
| `consent_events` | ~13 months (Art 7(1) demonstrability) |
| `pairing_codes` | 1h after expiry / 7d after consumption |

## Live feed

`/showcases/analytics/live` streams over SSE from `/api/analytics/stream`. **The events shown there are synthetic** — generated server-side for the demo. Production pageviews land through the collector like every other page. The stream endpoint is unauthenticated and self-limits: per-IP connect rate, a global concurrent-connection ceiling, and a hard 5-minute close.

## Related

- [two-lane-model.md](./two-lane-model.md) · [legitimate-interest.md](./legitimate-interest.md) · [dpia-screening.md](./dpia-screening.md)
- [../../stack/capabilities/gdpr.md](../../stack/capabilities/gdpr.md) — consent tiers and privacy rationale
- [../architecture/jobs.md](../architecture/jobs.md) — rollup and cleanup jobs
