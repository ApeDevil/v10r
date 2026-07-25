# The two-lane analytics model

## Status: active

Analytics is split into two lanes that share no identifier and no join key. The separation is
the load-bearing design decision in the whole subsystem.

```
ANONYMOUS LANE                        AUTHENTICATED LANE
analytics.events                      analytics.user_events
analytics.sessions
  visitor_id = SHA256(ip:ua)            user_id → auth.user (CASCADE)
  rotates daily                         stable, identified
  no FK, no user reference              no visitor_id column, ever
  basis: Art 6(1)(f) + LIA              basis: Art 6(1)(b) + 6(1)(f)
  ePrivacy: contested (see below)       ePrivacy: does not engage
  consent tier gates collection         no consent tier — Art 13 disclosure
  retention 60 days                     retention 180 days, or immediate on erasure
  public routes only                    /account/* only
  NOT in collectUserData                IS in collectUserData, section `behavior`
```

## Why the wall exists

If a hashed visitor could be walked to a user id, the anonymous lane would stop being
anonymous. Concretely, it would:

- become reachable by an Art 15 access request and an Art 17 erasure, which it currently is
  not and is not built to be;
- invalidate the necessity and balancing analysis in
  [legitimate-interest.md](./legitimate-interest.md), which is argued on the premise that the
  lane's subjects are unidentified;
- turn daily-rotating pseudonyms into a durable profile, which is precisely the
  characteristic that separates "counting visits" from "tracking people" in reasonable
  expectations.

Adding a join key between these tables is therefore **not a refactor — it is a change of
legal position**. `privacy/report.ts` says so in prose; `user-events.ts` enforces it in
schema; the erasure test in `privacy.test.ts` pins the consequence.

## Which lane claims a request

Decided in one place, `analytics/collect-policy.ts`, so the two collection paths cannot drift:

| Path | Lane | Note |
|---|---|---|
| `/`, `/blog/*`, `/showcases/*` … | anonymous | Public surfaces |
| `/account/*` | authenticated | Only when a session exists |
| `/admin/*` | neither | Operator's own usage — high volume, no insight |
| `/desk/*` | neither | Authenticated, excluded by decision |
| `/api/*`, `/_app/*`, `*.ico` | neither | Not pages |
| Bots, prefetch, prerender | neither | Not visitors |

A path is eligible for **exactly one** lane. Both the server hook and the SPA beacon endpoint
import the same predicates — they previously disagreed, and client-side navigations into
`/admin` and `/account` leaked into the anonymous lane as a result.

## The ePrivacy question

ePrivacy Art 5(3) / **TDDDG §25** gates *access to terminal equipment*, independently of
whether GDPR is satisfied. Two elements matter:

**The session cookie** is unambiguous. It writes to the device and is not strictly necessary,
so it requires consent. Below the `analytics` tier it is never set, an existing one is
actively deleted, and session grouping falls back to `hash(visitorId + UTC day)` — the
Plausible/Fathom pattern, which stores nothing on the device.

**The visitor hash itself is contested, and we do not claim otherwise.** No primary source —
EDPB, CNIL, DSK, or a court — resolves this exact pattern: no cookie, no added entropy, daily
rotation, aggregate-only output. Two credible readings exist:

- *Narrow:* IP and User-Agent are unavoidable HTTP transport metadata. Nothing additional is
  read from or written to the device, so Art 5(3) does not engage and it is purely an Art 6
  question.
- *Broad:* rooted in Art 29 WP Opinion 9/2014 on device fingerprinting and the
  technology-neutral framing of "access" in EDPB Guidelines 2/2023 — the User-Agent reports
  terminal configuration, and combining it with an IP for identification purposes is a form
  of access however it arrives.

We hold the narrow reading, with the mitigations that make it strongest: no added entropy,
daily rotation, aggregate-only output, short retention, and a documented LIA. **This is a
risk-managed position, not legal certainty.** Note also that Germany has no CNIL-style
administrative exemption for consent-free audience measurement; the DSK/BfDI consent-management-service
regime is a mechanism for *capturing* consent, not for dispensing with it.

**The operative consequence is a rule:** never add a signal to the visitor hash. Screen size,
timezone, canvas, fonts, `hardwareConcurrency` — each would convert an arguably-out-of-scope
technique into one that is confirmed in scope under Guidelines 2/2023, and would collapse the
narrow reading we rely on.

## Why the authenticated lane needs no consent tier

For a logged-in user the ePrivacy gate does not engage: the auth cookie is already strictly
necessary under **TDDDG §25(2) Nr.2**, so reading it requires no further permission. The
processing rests on Art 6(1)(b) — operating the account the user asked for — and Art 6(1)(f)
for improving it. This is **disclosed** under Art 13, not consented to under Art 6(1)(a), and
the consent banner correctly says nothing about it.

The hard stop is **Art 22**: nothing derived from this lane may drive a solely automated
decision producing legal or similarly significant effects for the user. Aggregate product
analytics — cohorts, retention, funnels, which screens get used — is fine. Automated account
restriction, materially consequential personalisation, or scoring is not, and would need
explicit consent, contractual necessity, or a Member State law basis.

## Related

- [legitimate-interest.md](./legitimate-interest.md) — the Art 6(1)(f) assessment
- [dpia-screening.md](./dpia-screening.md) — Art 35 screening
- [activation.md](./activation.md) — collector wiring
- [../../stack/capabilities/gdpr.md](../../stack/capabilities/gdpr.md) — data-subject rights
