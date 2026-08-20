---
title: "Consent-gated sessions (cookieless day-rotating id)"
description: "Session identification switches between a cookie-based id under the analytics consent tier and a cookieless hash(visitorId + UTC day) id under the necessary…"
category: "Analytics"
---

# Consent-gated sessions (cookieless day-rotating id)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — reads a consent cookie only, no external service

Session identification switches between a cookie-based id under the analytics consent tier and a cookieless hash(visitorId + UTC day) id under the necessary tier, so both tiers still produce a countable session.

**When to use:** Use when session tracking must stay legally gated by consent tier (TDDDG/ePrivacy) while still counting unique sessions at the lowest tier.

## Docs

- [docs/blueprint/analytics/activation.md](/docs/blueprint/analytics/activation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/analytics/activation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/analytics/activation.md))
- [docs/stack/capabilities/gdpr.md](/docs/stack/gdpr) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/gdpr.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/gdpr.md))

## Code

- `src/lib/server/analytics/consent.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/analytics/consent.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/analytics/consent.ts))

## Proof

- [`/showcases/analytics/privacy`](/showcases/analytics/privacy)

---

_Machine-readable record: `analytics-consent-sessions` in `mcp/patterns.registry.json`._
