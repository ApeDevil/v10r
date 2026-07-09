# Analytics

Privacy-first, first-party analytics blueprints. Collection is a middleware concern — the collector runs as the final stage of the 12-stage hook chain in `src/hooks.server.ts` — and every write is consent-gated (TDDDG §25 / ePrivacy).

## Contents

| File | Main Topics |
|------|-------------|
| **[activation.md](./activation.md)** | • Collector hook position (last of 12, after route guards) and what it tracks (public GET pageviews only; `/admin` and `/account` never recorded)<br>• Writes: `analytics.events` + `analytics.sessions`, debug-pairing attribution<br>• Consent gating: `_v10r_sid` cookie at `analytics` tier vs cookieless day-rotating session id (`hash(visitorId + UTC day)`)<br>• Referrer recorded only at `analytics`+ tier<br>• Daily rollup job into `analytics.daily_page_stats` |

## Related

- [stack/capabilities/gdpr.md](../../stack/capabilities/gdpr.md) — consent tiers and privacy rationale
- [architecture/jobs.md](../architecture/jobs.md) — `analytics-rollup` / `analytics-cleanup` jobs
- Server domain: `src/lib/server/analytics/` · dashboards: `/showcases/analytics/*` and `/admin/analytics`
