---
title: "OAuth (GitHub, Google)"
description: "Sign-in via OAuth 2.0 providers, GitHub and Google, wired through Better Auth's built-in OAuth plugin."
category: "Identity & Access"
---

# OAuth (GitHub, Google)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Identity & Access · **Tier:** light · **Risk:** medium — external managed service (OAuth identity providers)

Sign-in via OAuth 2.0 providers, GitHub and Google, wired through Better Auth's built-in OAuth plugin.

**When to use:** Offer it alongside magic link/OTP as an alternative sign-in path for users who prefer an existing provider account.

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/server/auth/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/auth) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/auth))

## Proof

- [`/showcases/auth/authn`](/showcases/auth/authn)

---

_Machine-readable record: `identity-oauth` in `mcp/patterns.registry.json`._
