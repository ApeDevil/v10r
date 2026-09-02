---
title: "Route guards & per-route authorization"
description: "Server-side guard functions that check a user's capability grants or admin status before allowing access to a route or API endpoint."
category: "Identity & Access"
---

# Route guards & per-route authorization

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Identity & Access · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — application-level authorization logic, no external calls

Server-side guard functions that check a user's capability grants or admin status before allowing access to a route or API endpoint.

**When to use:** Use on any route or endpoint that must restrict access beyond plain authentication, including the 404-not-403 admin gate.

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/server/http/guards.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/guards.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/guards.ts))

## Proof

- [`/showcases/auth/authz`](/showcases/auth/authz)

---

_Machine-readable record: `identity-route-guards` in `pattern-library/registry.json`._
