---
title: "Passkeys & step-up TOTP"
description: "WebAuthn passkeys serve as a phishing-resistant first-factor sign-in credential, while TOTP is repurposed as a step-up check before sensitive actions, gated…"
category: "Identity & Access"
---

# Passkeys & step-up TOTP

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Identity & Access · **Tier:** light · **Risk:** medium — security-critical auth factor, Redis-backed step-up gate

WebAuthn passkeys serve as a phishing-resistant first-factor sign-in credential, while TOTP is repurposed as a step-up check before sensitive actions, gated by a Redis freshness stamp.

**When to use:** Use passkeys to harden sign-in and step-up TOTP to re-verify identity right before a sensitive action like disabling 2FA.

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/server/auth/step-up.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/step-up.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/step-up.ts))
- `src/lib/server/auth/factor-changes.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/factor-changes.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/factor-changes.ts))
- `src/lib/components/composites/step-up-dialog/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/step-up-dialog) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/step-up-dialog))

## Proof

- [`/account/security`](/account/security) (app route, no showcase)

---

_Machine-readable record: `identity-passkeys` in `mcp/patterns.registry.json`._
