---
title: "Auth forms (Better Auth client, not Superforms)"
description: "Passwordless login (magic link + OTP) and OAuth forms built directly on the Better Auth client instead of Superforms, since Better Auth already handles rate…"
category: "Forms & Validation"
---

# Auth forms (Better Auth client, not Superforms)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Forms & Validation · **Tier:** light · **Risk:** medium — authentication flow, delegated to Better Auth client

Passwordless login (magic link + OTP) and OAuth forms built directly on the Better Auth client instead of Superforms, since Better Auth already handles rate limiting and token validation.

**When to use:** Use for any authentication entry point (email login, OTP verification, OAuth) instead of wiring the flow through Superforms.

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/auth-client.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/auth-client.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/auth-client.ts))

## Proof

- [`/showcases/forms/auth`](/showcases/forms/auth)

---

_Machine-readable record: `forms-auth-forms` in `mcp/patterns.registry.json`._
