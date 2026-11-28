---
title: "Audit log"
description: "An append-only audit trail of privileged admin actions — who did what to which record, when — under the admin server module (which also hosts the…"
category: "Admin & Privacy"
---

# Audit log

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Admin & Privacy · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — audit integrity and flag correctness affect privileged operations

An append-only audit trail of privileged admin actions — who did what to which record, when — under the admin server module (which also hosts the site-announcements feature).

**When to use:** Use when an admin action needs to be logged or a message needs to be broadcast to users.

**Needs:** required relational-db

## Docs

- `docs/blueprint/admin/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/admin/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/admin/README.md))

## Code

- `src/lib/server/admin/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/admin) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/admin))

## Proof

- [`/admin`](/admin) (app route, no showcase)

---

_Machine-readable record: `audit-log` in `pattern-library/registry.json`._
