---
title: "OAuth sign-in"
description: "Sign-in via OAuth 2.0 providers, GitHub and Google, wired through Better Auth's built-in OAuth plugin."
category: "Identity & Access"
---

# OAuth sign-in

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Identity & Access · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (OAuth identity providers)

Sign-in via OAuth 2.0 providers, GitHub and Google, wired through Better Auth's built-in OAuth plugin.

**When to use:** Offer it alongside magic link/OTP as an alternative sign-in path for users who prefer an existing provider account.

**Needs:** required relational-db, external-api · conditional key-value-store (when sessions must be revoked across instances (the revocation list is shared)) · v10r's implementation uses email-delivery

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/server/auth/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/auth) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/auth))

## Proof

- [`/showcases/auth/authn`](/showcases/auth/authn)

---

_Machine-readable record: `oauth-sign-in` in `pattern-library/registry.json`._
