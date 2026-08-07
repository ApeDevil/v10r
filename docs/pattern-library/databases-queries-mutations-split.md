---
title: "Queries/mutations split (reads-writes duality)"
description: "Splits each domain's database access into separate queries.ts (reads) and mutations.ts (writes) modules."
category: "Databases & Storage"
---

# Queries/mutations split (reads-writes duality)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Risk:** low — code organization pattern, no external dependency

Splits each domain's database access into separate queries.ts (reads) and mutations.ts (writes) modules.

**When to use:** Apply when structuring a new domain's database layer so reads and writes stay independently reusable across UI, API, and job clients.

## Docs

- [docs/codebase-organization.md](/docs/codebase-organization) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/codebase-organization.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/codebase-organization.md))

## Code

- `src/lib/server/db/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db))

## Proof

- [`/showcases/db/relational/mutability`](/showcases/db/relational/mutability)

---

_Machine-readable record: `databases-queries-mutations-split` in `mcp/patterns.registry.json`._
