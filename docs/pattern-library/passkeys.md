---
title: "Passkeys & step-up TOTP"
description: "WebAuthn passkeys serve as a phishing-resistant first-factor sign-in credential, while TOTP is repurposed as a step-up check before sensitive actions, gated…"
category: "Identity & Access"
---

# Passkeys & step-up TOTP

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Identity & Access · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — security-critical auth factor, Redis-backed step-up gate

WebAuthn passkeys serve as a phishing-resistant first-factor sign-in credential, while TOTP is repurposed as a step-up check before sensitive actions, gated by a Redis freshness stamp.

**When to use:** Use passkeys to harden sign-in and step-up TOTP to re-verify identity right before a sensitive action like disabling 2FA.

**Needs:** required email-delivery (via passwordless-auth), relational-db · conditional key-value-store (when step-up stamps must hold across instances)

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/server/auth/step-up.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/step-up.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/step-up.ts))
- `src/lib/server/auth/factor-changes.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/factor-changes.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/factor-changes.ts))
- `src/lib/components/composites/step-up-dialog/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/step-up-dialog) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/step-up-dialog))

## Proof

- [`/account/security`](/account/security) (app route, no showcase)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Passwordless auth](/docs/pattern-library/passwordless-auth) — Passkeys are another first-factor credential on the same session layer.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.
- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `passkeys` in `pattern-library/registry.json`._
