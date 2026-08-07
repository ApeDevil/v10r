---
title: "Capability grants (request → approve → expire)"
description: "A request-approve-expire workflow where users request a named capability, an admin approves or denies it, and pending requests auto-expire after 14 days."
category: "Identity & Access"
---

# Capability grants (request → approve → expire)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Identity & Access · **Tier:** light · **Risk:** low — application-level authorization logic, Postgres-backed

A request-approve-expire workflow where users request a named capability, an admin approves or denies it, and pending requests auto-expire after 14 days.

**When to use:** Use in place of static roles when access to a feature, such as blog authoring, needs an auditable grant/revoke lifecycle.

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/server/auth/grants.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/grants.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/grants.ts))
- `src/lib/server/auth/grant-requests.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/grant-requests.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/grant-requests.ts))

---

_Machine-readable record: `identity-capability-grants` in `mcp/patterns.registry.json`._
