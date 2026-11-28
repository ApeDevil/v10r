---
title: "Schema and type inference"
description: "Drizzle table definitions split across pgSchema() namespaces, one per domain, and re-exported from a single schema index for compile-time type inference."
category: "Databases & Storage"
---

# Schema and type inference

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Neon Postgres)

Drizzle table definitions split across pgSchema() namespaces, one per domain, and re-exported from a single schema index for compile-time type inference.

**When to use:** Use when adding or changing database tables and query results need to stay type-safe end to end.

**Needs:** required relational-db · v10r's implementation uses vector-search

## Docs

- [docs/blueprint/db/relational.md](/docs/blueprint/db/relational) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/db/relational.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/db/relational.md))
- [docs/stack/data/drizzle.md](/docs/stack/drizzle) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/data/drizzle.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/data/drizzle.md))

## Code

- `src/lib/server/db/schema/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/schema) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/schema))

## Proof

- [`/showcases/db/relational/types`](/showcases/db/relational/types)

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `schema-type-inference` in `pattern-library/registry.json`._
