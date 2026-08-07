---
title: "User management"
description: "User account routes and server-side data access covering profile, settings, notifications, security, and GDPR data export."
category: "Identity & Access"
---

# User management

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Identity & Access · **Tier:** light · **Risk:** medium — handles GDPR-sensitive personal data

User account routes and server-side data access covering profile, settings, notifications, security, and GDPR data export.

**When to use:** Use when building or modifying the account area where users manage their own identity, security factors, and personal data.

## Docs

- [docs/blueprint/app-shell/user-account.md](/docs/blueprint/app-shell/user-account) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/user-account.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/user-account.md))

## Code

- `src/lib/server/db/user/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/user) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/user))

## Proof

- [`/showcases/auth/users`](/showcases/auth/users)

---

_Machine-readable record: `identity-user-management` in `mcp/patterns.registry.json`._
