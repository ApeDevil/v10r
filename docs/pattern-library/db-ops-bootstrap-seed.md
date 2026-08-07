---
title: "DB bootstrap & seed"
description: "Scripts and seed modules that populate a fresh database with baseline and sample data."
category: "Database Operations"
---

# DB bootstrap & seed

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Database Operations · **Tier:** light · **Risk:** low — dev-time tooling, no production runtime dependency

Scripts and seed modules that populate a fresh database with baseline and sample data.

**When to use:** Run when provisioning a new environment or resetting a dev database to a known-good starting state.

## Docs

- `docs/blueprint/data/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/data/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/data/README.md))

## Code

- `src/lib/server/db/seed/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/seed) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/seed))
- `scripts/db/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/scripts/db) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/scripts/db))

---

_Machine-readable record: `db-ops-bootstrap-seed` in `mcp/patterns.registry.json`._
