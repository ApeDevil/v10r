---
title: "Queries/mutations split"
description: "Splits each domain's database access into separate queries.ts (reads) and mutations.ts (writes) modules."
category: "Databases & Storage"
---

# Queries/mutations split

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — code organization pattern, no external dependency

Splits each domain's database access into separate queries.ts (reads) and mutations.ts (writes) modules.

**When to use:** Apply when structuring a new domain's database layer so reads and writes stay independently reusable across UI, API, and job clients.

**Needs:** required relational-db · v10r's implementation uses vector-search

## Docs

- [docs/codebase-organization.md](/docs/codebase-organization) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/codebase-organization.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/codebase-organization.md))

## Code

- `src/lib/server/db/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db))

## Proof

- [`/showcases/db/relational/mutability`](/showcases/db/relational/mutability)

---

_Machine-readable record: `queries-mutations-split` in `pattern-library/registry.json`._
