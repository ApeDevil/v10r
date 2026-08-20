---
title: "Consent & cookies"
description: "Client-side consent state and a consent banner component that gate any cookie or storage write, satisfying ePrivacy/TDDDG consent requirements."
category: "Admin & Privacy"
---

# Consent & cookies

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Admin & Privacy · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — consent bugs cause non-compliant cookie writes

Client-side consent state and a consent banner component that gate any cookie or storage write, satisfying ePrivacy/TDDDG consent requirements.

**When to use:** Use before writing any non-essential cookie or client-side tracking value that requires prior user consent.

## Docs

- [docs/stack/capabilities/gdpr.md](/docs/stack/gdpr) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/gdpr.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/gdpr.md))

## Code

- `src/lib/state/consent.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/consent.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/consent.svelte.ts))
- `src/lib/components/shell/ConsentBanner.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/ConsentBanner.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/ConsentBanner.svelte))

## Proof

- [`/showcases/privacy/cookies`](/showcases/privacy/cookies)

---

_Machine-readable record: `admin-privacy-consent-cookies` in `mcp/patterns.registry.json`._
