---
title: "Passwordless auth (magic link + OTP)"
description: "Session-based authentication through Better Auth using a magic link and OTP code sent together in one email, with no passwords stored."
category: "Identity & Access"
---

# Passwordless auth (magic link + OTP)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Identity & Access · **Tier:** light · **Risk:** medium — external managed service (email delivery)

Session-based authentication through Better Auth using a magic link and OTP code sent together in one email, with no passwords stored.

**When to use:** Use as the primary sign-in method to avoid password-related breach risk and reset friction.

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))
- [docs/stack/auth/better-auth.md](/docs/stack/better-auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/auth/better-auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/auth/better-auth.md))

## Code

- `src/lib/server/auth/index.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/index.ts))
- `src/lib/auth-client.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/auth-client.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/auth-client.ts))

## Proof

- [`/showcases/auth/authn`](/showcases/auth/authn)

---

_Machine-readable record: `identity-passwordless-auth` in `mcp/patterns.registry.json`._
