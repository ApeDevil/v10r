---
title: "Database branch refresh from production"
description: "Resets the dev Neon Postgres branch from its production parent through Neon's control-plane API, recording each run in a ledger and surfacing it at an…"
category: "Database Operations"
---

# Database branch refresh from production

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** workflow — perform it as a procedure against an existing project; nothing builds on it

**Category:** Database Operations · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Neon control plane), admin-only destructive op

Resets the dev Neon Postgres branch from its production parent through Neon's control-plane API, recording each run in a ledger and surfacing it at an admin-only page.

**When to use:** Use when developers need production-like data in the dev branch on demand or on a schedule, without a manual dump and restore.

**Needs:** required relational-db (pinned: postgres), external-api

## Docs

- [docs/blueprint/data/neon-branch-refresh.md](/docs/blueprint/data/neon-branch-refresh) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/data/neon-branch-refresh.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/data/neon-branch-refresh.md))

## Code

- `src/lib/server/neon/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/neon) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/neon))
- `src/lib/server/dbops/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/dbops) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/dbops))

## Proof

- [`/admin/db`](/admin/db) (app route, no showcase)

---

_Machine-readable record: `database-branch-refresh` in `pattern-library/registry.json`._
