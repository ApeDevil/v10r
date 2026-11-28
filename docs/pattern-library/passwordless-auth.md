---
title: "Passwordless auth"
description: "Session-based authentication through Better Auth using a magic link and OTP code sent together in one email, with no passwords stored."
category: "Identity & Access"
---

# Passwordless auth

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Identity & Access · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (email delivery)

Session-based authentication through Better Auth using a magic link and OTP code sent together in one email, with no passwords stored.

**When to use:** Use as the primary sign-in method to avoid password-related breach risk and reset friction.

**Needs:** required email-delivery, relational-db

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))
- [docs/stack/auth/better-auth.md](/docs/stack/better-auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/auth/better-auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/auth/better-auth.md))

## Code

- `src/lib/server/auth/index.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/index.ts))
- `src/lib/auth-client.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/auth-client.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/auth-client.ts))

## Proof

- [`/showcases/auth/authn`](/showcases/auth/authn)

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Built on by**

- [MCP authorization](/docs/pattern-library/mcp-authorization)
- [Session lifecycle UI](/docs/pattern-library/session-lifecycle-ui)
- [Auth forms](/docs/pattern-library/auth-forms)
- [Passkeys & step-up TOTP](/docs/pattern-library/passkeys)

**Referenced by**

- [OAuth sign-in](/docs/pattern-library/oauth-sign-in)


---

_Machine-readable record: `passwordless-auth` in `pattern-library/registry.json`._
