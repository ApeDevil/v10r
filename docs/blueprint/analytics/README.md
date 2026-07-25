# Analytics

Privacy-first, first-party analytics blueprints. Collection is a middleware concern — the collector runs as the final stage of the 12-stage hook chain in `src/hooks.server.ts` — and the subsystem is split into two lanes that share no identifier: an anonymous visitor lane and an authenticated user lane.

## Contents

| File | Main Topics |
|------|-------------|
| **[two-lane-model.md](./two-lane-model.md)** | • The wall: `analytics.events` (hashed visitor) vs `analytics.user_events` (user id), no join key<br>• Why joining them is a change of legal position, not a refactor<br>• Which lane claims which path (`collect-policy.ts` as the single decision point)<br>• The contested ePrivacy status of `SHA256(ip:ua)` — both readings, stated honestly<br>• Why the authenticated lane needs no consent tier (TDDDG §25(2) Nr.2) and where Art 22 stops it |
| **[legitimate-interest.md](./legitimate-interest.md)** | • Art 6(1)(f) LIA, three limbs per EDPB Guidelines 1/2024<br>• Why the hash is pseudonymous not anonymous (CJEU *EDPS v SRB*, Sept 2025)<br>• Per-element necessity table, and what was rejected as unnecessary<br>• Balancing: reasonable expectations, impact, code-enforced safeguards<br>• Art 21 objection route; review triggers |
| **[dpia-screening.md](./dpia-screening.md)** | • Art 35(3) mandatory triggers — none fire<br>• WP248 nine-criteria table, one partial, below threshold<br>• What would have crossed it (replay, lane-joining, added entropy, form content)<br>• Re-screening triggers |
| **[activation.md](./activation.md)** | • Collector hook position (last of 12) and what each lane records<br>• Consent gating: `_v10r_sid` at `analytics` tier vs cookieless day-rotating session id<br>• Server-side enrichment: country (connection-derived, every tier) vs device/browser (UA-derived, `analytics` tier)<br>• Custom events + the cardinality budget (closed allowlist, write-time path templating)<br>• Client telemetry: Web Vitals with attribution, engaged time, rage/dead clicks, scroll depth<br>• Daily rollup: engaged-time duration and the redefined bounce rate<br>• Retention: 60d anonymous, 180d authenticated, one cron for all of it |

## Related

- [stack/capabilities/gdpr.md](../../stack/capabilities/gdpr.md) — data-subject rights and the privacy aggregator
- [architecture/jobs.md](../architecture/jobs.md) — `analytics-rollup` / `analytics-cleanup` jobs
- Server domain: `src/lib/server/analytics/` · client: `src/lib/analytics/` · dashboards: `/showcases/analytics/*` and `/admin/analytics`
