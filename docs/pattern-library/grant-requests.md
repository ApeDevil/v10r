---
title: "Grant requests"
description: "A request-approve-expire workflow where users request a named capability, an admin approves or denies it, and pending requests auto-expire after 14 days."
category: "Identity & Access"
---

# Grant requests

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Identity & Access · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — application-level authorization logic, Postgres-backed

A request-approve-expire workflow where users request a named capability, an admin approves or denies it, and pending requests auto-expire after 14 days.

**When to use:** Use in place of static roles when access to a feature, such as blog authoring, needs an auditable grant/revoke lifecycle.

**Needs:** required relational-db · conditional scheduler (when grant requests expire on a schedule)

## Docs

- [docs/blueprint/auth.md](/docs/blueprint/auth) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/auth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/auth.md))

## Code

- `src/lib/server/auth/grants.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/grants.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/grants.ts))
- `src/lib/server/auth/grant-requests.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/grant-requests.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/grant-requests.ts))

## Tests

- `src/lib/server/http/guards.test.ts` — Covers grant-based capability checks ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/guards.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/guards.test.ts))

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `grant-requests` in `pattern-library/registry.json`._
