---
title: "Audit log, announcements, feature flags"
description: "Admin-side systems for recording an audit trail of privileged actions, publishing site announcements, and toggling feature flags, all under the admin server…"
category: "Admin & Privacy"
---

# Audit log, announcements, feature flags

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Admin & Privacy · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — audit integrity and flag correctness affect privileged operations

Admin-side systems for recording an audit trail of privileged actions, publishing site announcements, and toggling feature flags, all under the admin server module.

**When to use:** Use when an admin action needs to be logged, a message needs to be broadcast to users, or a feature needs a togglable flag.

## Docs

- `docs/blueprint/admin/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/admin/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/admin/README.md))

## Code

- `src/lib/server/admin/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/admin) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/admin))

## Proof

- [`/admin`](/admin) (app route, no showcase)

---

_Machine-readable record: `admin-privacy-audit-log` in `pattern-library/registry.json`._
