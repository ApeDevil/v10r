---
title: "Consent & cookies"
description: "Client-side consent state and a consent banner component that gate any cookie or storage write, satisfying ePrivacy/TDDDG consent requirements."
category: "Admin & Privacy"
---

# Consent & cookies

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

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

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.

**Built on by**

- [Consent-gated sessions](/docs/pattern-library/consent-gated-sessions)


---

_Machine-readable record: `consent-cookies` in `pattern-library/registry.json`._
