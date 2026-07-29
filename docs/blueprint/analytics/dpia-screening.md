# DPIA screening — analytics

## Status: screened, no DPIA required at current scope

GDPR Art 35(1) requires a Data Protection Impact Assessment where processing is "likely to
result in a **high risk**" to data subjects. This document records the screening, the
reasoning, and — importantly — the design choices that were made *in order to* stay below the
threshold. It is not a DPIA; it is the evidence that one is not currently owed.

**Scope: the two web-analytics lanes only.** MCP usage telemetry (`mcp.call_log`, see
[architecture/hosted-mcp.md](../architecture/hosted-mcp.md)) is a separate subsystem this
screening does not cover.

## Art 35(3) — the mandatory triggers

| Trigger | Applies? | Reasoning |
|---|---|---|
| (a) Systematic and extensive **evaluation of personal aspects**, based on automated processing, on which **decisions producing legal or similarly significant effects** are based | **No** | No decision of any kind is made about an individual. Output is aggregate. Art 22 is a hard boundary in both lanes. |
| (b) Large-scale processing of **special categories** (Art 9) or criminal-offence data | **No** | No special-category data is sought or collected. Form-field *content* — the plausible accidental route to Art 9 data — is never read; only which field was abandoned. |
| (c) Systematic **monitoring of a publicly accessible area** on a large scale | **No** | "Publicly accessible area" in Art 35(3)(c) means physical space (CCTV and equivalents), not a website. |

None of the three mandatory triggers fires.

## WP248 rev.01 — the nine criteria

The Art 29 WP guidance (endorsed by the EDPB) treats **two or more** criteria as a strong
indicator that a DPIA is needed.

| # | Criterion | Met? | Reasoning |
|---|---|---|---|
| 1 | Evaluation or scoring | No | Nothing is scored, ranked, or predicted. |
| 2 | Automated decision-making with legal/significant effect | No | No decisions. Art 22 boundary is explicit and enforced. |
| 3 | Systematic monitoring | **Partly** | Behaviour on our own site is observed systematically. Mitigated: the identifier is keyed rather than a bare digest, so it cannot be reversed to (IP, UA) from a database copy; it carries no cross-site or third-party key, so nothing accumulates beyond this one site; every row is deleted at 60 days; and observation stops entirely on objection. Note the identifier does NOT rotate daily — see the necessity analysis in legitimate-interest.md. |
| 4 | Sensitive data / highly personal data | No | None collected. |
| 5 | Data processed on a large scale | No | A single small site. Not large scale on WP248's volume, geography, duration, or subject-count factors. |
| 6 | Matching or combining datasets | No | **This is what the two-lane wall prevents.** The anonymous and authenticated lanes share no key and cannot be joined. |
| 7 | Data concerning vulnerable subjects | No | No children's data sought; no employee/patient relationship. |
| 8 | Innovative use or new technology | No | Conventional first-party server-side analytics. |
| 9 | Processing preventing rights/contract access | No | Nothing is gated on it. |

**Score: one partial.** Below the two-criteria indicator, and the single partial is itself
mitigated by daily rotation and a working objection route.

## What would have crossed the threshold

Recorded deliberately, because the screening only holds while these stay out of scope:

- **Session replay / DOM recording.** Would immediately engage criteria 3 and 4 (recordings
  routinely capture incidental sensitive data), and plausibly 1. Rejected — see the necessity
  analysis in [legitimate-interest.md](./legitimate-interest.md#limb-2--necessity-test). Note
  the CNIL recommendation on this is still in draft as of this writing; its direction
  (mandatory masking, minimisation, purpose limitation, DPIA likely) is a reliable signal even
  though the final text is not fixed.
- **Joining the two lanes.** Criterion 6, directly. It would also convert criterion 3 from
  partial to full, since a stable identity plus behavioural history *is* a profile.
- **Adding entropy to the visitor hash.** Moves the technique into confirmed fingerprinting
  territory under EDPB Guidelines 2/2023, strengthening criterion 3 and adding an ePrivacy
  consent obligation on top.
- **Form-field content capture.** Criterion 4, via incidental Art 9 data.
- **Any personalisation or scoring** derived from either lane. Criteria 1 and 2, and Art 22.

## Re-screening triggers

Re-run this screening before adding any item from the list above, before any material change
in traffic scale, and whenever [legitimate-interest.md](./legitimate-interest.md) is re-run —
the two documents share their factual basis and should not drift apart.

## Related

- [legitimate-interest.md](./legitimate-interest.md) — Art 6(1)(f) assessment
- [two-lane-model.md](./two-lane-model.md) — the separation this screening depends on
