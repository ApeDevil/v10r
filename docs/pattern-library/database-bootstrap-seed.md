---
title: "Database bootstrap and seed"
description: "Scripts and seed modules that populate a fresh database with baseline and sample data."
category: "Database Operations"
---

# Database bootstrap and seed

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** workflow — perform it as a procedure against an existing project; nothing builds on it

**Category:** Database Operations · **Tier:** light · **Maturity:** implemented · **Risk:** low — dev-time tooling, no production runtime dependency

Scripts and seed modules that populate a fresh database with baseline and sample data.

**When to use:** Run when provisioning a new environment or resetting a dev database to a known-good starting state.

**Needs:** required relational-db · conditional graph-db (when the project mirrors its catalogue into a graph store), llm-provider (when the seed also embeds documents for retrieval)

## Docs

- `docs/blueprint/data/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/data/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/data/README.md))

## Code

- `src/lib/server/db/seed/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/seed) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/seed))
- `scripts/db/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/scripts/db) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/scripts/db))

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `database-bootstrap-seed` in `pattern-library/registry.json`._
