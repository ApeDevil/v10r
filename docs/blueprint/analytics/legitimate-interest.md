# Legitimate Interest Assessment — anonymous analytics lane

## Status: on file

Covers `analytics.events` + `analytics.sessions` — the **anonymous lane**, keyed by
`SHA256(ip:ua)`. The authenticated lane (`analytics.user_events`) rests on Art 6(1)(b)/(f)
and is assessed separately in [two-lane-model.md](./two-lane-model.md).

**Controller:** the site operator (Germany). **Basis claimed:** GDPR Art 6(1)(f).

## Why this document exists

Two things are easy to get wrong here, and both were wrong before this assessment:

1. **The hash does not make the data anonymous.** In *EDPS v SRB* (C‑413/23 P, 4 Sept 2025)
   the CJEU held that identifiability is judged **from the controller's own position and at
   the time of collection**. We hold the raw IP and User-Agent before hashing and we control
   the algorithm. The result is therefore pseudonymous personal data *for us*, whatever it
   looks like to a third party. GDPR applies in full, and a legal basis is required.
2. **ePrivacy and GDPR are separate gates.** Clearing one does not clear the other. This
   document addresses only the GDPR limb. The terminal-equipment question is in
   [two-lane-model.md](./two-lane-model.md#the-eprivacy-question).

Per EDPB Guidelines 1/2024 (adopted 8 Oct 2024, reflecting CJEU C‑621/22 *KNLTB*), Art 6(1)(f)
requires a **cumulative** three-part test. All three are assessed below.

---

## Limb 1 — Purpose test

**Interest:** understanding how the site is used, in aggregate, in order to operate and
improve it: which pages are read, which are ignored, where navigation breaks down, where the
interface is slow, and where visitors get stuck.

Is the interest **real** (not speculative), **present** (not hypothetical), and **lawful**?

- Real and present: the data feeds live surfaces (`/admin/analytics`, the analytics showcase
  pages) that inform actual decisions about what to build and fix.
- Lawful: *KNLTB* confirmed that a purely commercial interest can qualify. Operating and
  improving one's own website is well within that.

A purely commercial interest still has to survive Limb 3. It is not a free pass.

## Limb 2 — Necessity test

The bar is **necessary**, not *useful* and not *more convenient*. For each element we ask
whether a less intrusive route reaches the same purpose.

| Element | Necessary? | Reasoning |
|---|---|---|
| Keyed visitor hash | Yes | Without any grouping key, pageviews cannot be distinguished from reloads and "unique visitors" is unanswerable. It is `HMAC-SHA256(server key, ip + user-agent)` — keyed, so it cannot be reversed by sweeping the address space, which an unkeyed digest can be. It does **not** rotate daily: "unique visitors over 30 days" is a question the hash exists to answer, and a daily-rotating input would inflate that count by the number of days. The key is rotatable instead, at or above the 60-day retention window, so at most one boundary can fall inside any reporting range. |
| Path + templated route | Yes | The measurement itself. |
| Country (from connection) | Yes | Answers "who is this site for", and is coarse by construction — country level only, never city or coordinates. |
| Referrer | Yes | Answers "how do people find this", unanswerable any other way. |
| Device / browser family | Yes | Drives what gets tested and supported. Deliberately coarse: family only, never a version string. |
| Engaged time, scroll depth | Yes | Distinguishes read from bounced. Wall-clock time cannot — a forgotten tab looks identical to careful reading. |
| Rage / dead clicks, form-field abandonment | Yes | The "where do people get stuck" question. These are the aggregate signals that make **session replay unnecessary**, which is the less-intrusive-alternative argument in its strongest form. |
| Web Vitals + attribution | Yes | A bare metric identifies a problem; attribution identifies the element responsible. Without it the data cannot be acted on, so collecting it without attribution would fail this limb. |
| Confirmation flag (`human_confirmed_at`) | Yes | Without it, header-copying crawlers are indistinguishable from people and the visitor count is fiction (measured: 96% of one week's "visitors" never ran JavaScript). The signal is one consent-free constant-payload ping that reads nothing from the device — the least data that can answer "did a browser actually render this". |
| Connection class (`ip_class`) | Yes | Ranks the unconfirmed remainder (datacenter vs relay vs unknown) so the operator can judge the crawler share without storing addresses. The IP is compared against published ranges inside the INSERT and never written; only the three-valued class survives. Never used to exclude — its false positives are VPN and Private Relay users. |

**Rejected as unnecessary** — considered and deliberately not collected:

- **Session replay / DOM recording.** Would answer some of the same questions far more
  intrusively. The derived signals above cover the purpose. Fails Limb 2 outright.
- **Heatmaps, mouse tracks, keystrokes.** Same reasoning.
- **Form field content.** Only *which* field was abandoned is needed. Content may
  incidentally capture Art 9 special-category data, and is never read.
- **Any additional fingerprinting entropy** — screen size, timezone, canvas, fonts,
  `hardwareConcurrency`. Would marginally improve visitor counting at a disproportionate cost
  to identifiability. Also see the ePrivacy consequence in the two-lane doc: adding entropy
  moves the technique into the confirmed scope of EDPB Guidelines 2/2023.
- **Raw IP storage.** Never stored in any table. The hash is computed and the input discarded;
  the ip-class comparison likewise discards the address inside the same statement.
- **Cross-site or third-party identifiers.** No identifier of ours leaves the first party.
  There is no pixel and no tag manager. The one third-party measurement — Vercel Web
  Analytics — is injected only after Art 6(1)(a) consent, generates its own 24h-discarded
  hash, and receives no identifier from this lane; Vercel Inc. additionally processes all
  traffic as the hosting provider (Art 28, EU SCCs), which the privacy pages disclose.

## Limb 3 — Balancing test

**Nature of the data:** pseudonymous, no special categories, no children's data sought.

**Reasonable expectations (Recital 47).** A visitor to a website reasonably expects the
operator to count visits and measure performance. That is the mainstream expectation for
first-party analytics. Where expectation gets strained is tracking *across* sites, profiling,
and ad targeting — none of which happen here.

**Impact on the data subject:** low, and bounded by design.

- No decision is ever made about an individual. Output is aggregate.
- No profile is built: the *session* identifier rotates every UTC day, and the visitor hash —
  which does persist across days, deliberately, to answer "unique visitors this month" — is
  bounded by the 60-day retention window, a rotatable key, and the no-added-entropy rule
  (see Limb 2, first row). What accumulates is a count, never a behavioural profile.
- No cross-site tracking, no data sharing, no sale.
- Raw events are deleted after **60 days**; aggregates carry no identifier at all.

**Safeguards applied** (each is enforced in code, not policy):

| Safeguard | Where |
|---|---|
| Keyed, non-reversible visitor identifier | `analytics/consent.ts` `hashVisitorId`, keyed via `analytics/visitor.ts` |
| Daily-rotating session identifier | `analytics/consent.ts` `deriveCookielessSessionId` |
| Referrer reduced to an origin before storage | `db/analytics/mutations.ts` — the write chokepoint, so every lane inherits it |
| No raw IP persisted anywhere | `analytics/hook.ts` — hashed before write |
| Authenticated surfaces excluded from this lane | `analytics/collect-policy.ts` |
| No join key to the identified lane | schema-level; see `user-events.ts` docblock |
| Closed allowlist on event names and properties | `analytics/event-schema.ts` |
| 60-day deletion, pinned by test | `jobs/analytics-cleanup.ts`, `analytics.test.ts` |
| Bot and prefetch traffic excluded | `analytics/collect-policy.ts` |
| Confirm ping reads nothing from the device (constant payload, HMAC-bound token) | `analytics/confirm-ping.ts`, `analytics/confirm-token.ts` |
| IP compared for classification, never stored | `db/analytics/mutations.ts` `upsertSession` — inside the INSERT |
| Operator's own tagged traffic excluded from all aggregates | `db/analytics/aggregations.ts`, `jobs/analytics-rollup.ts` |

**Right to object (Art 21).** Rejecting the analytics tier in the consent banner stops the
cookie, the referrer, device/browser parsing, and all behavioural events. The banner is
reachable at any time from `/showcases/privacy/cookies`, and rejection is exactly as easy as
acceptance (equal-weight buttons, no dark pattern — EDPB Guidelines 05/2020 and the 2023
Cookie Banner Taskforce report).

**Outcome:** the interest is not overridden. The processing is proportionate, the impact is
low and time-boxed, an objection route exists and is honoured in code, and every genuinely
intrusive alternative was considered and rejected.

## Review triggers

Re-run this assessment before any of the following. Each would change a limb:

- Adding any signal to the visitor hash (Limb 2 and Limb 3 both change).
- Rotating the visitor-hash key faster than the retention window, or not at all for longer than one.
- Widening the stored referrer beyond an origin. The full URL of a page a visitor arrives from can
  contain a magic-link, password-reset or OAuth token in its query string.
- Introducing any cross-session or cross-site identifier.
- Extending raw-event retention beyond 60 days.
- Introducing any per-individual decision, ranking, or personalisation from this lane.
- Sharing analytics data with any third party.
- Adding session replay, heatmaps, or form-content capture — each was rejected at Limb 2, so
  reintroducing one reopens the whole assessment.
- Adding ANY field to the confirm ping's payload, or letting `ip_class` feed an exclusion
  predicate rather than a ranking — either changes what §25/Limb 3 were assessed on.

## Related

- [two-lane-model.md](./two-lane-model.md) — the architecture and the ePrivacy limb
- [dpia-screening.md](./dpia-screening.md) — Art 35 screening
- [activation.md](./activation.md) — what the collector actually does
