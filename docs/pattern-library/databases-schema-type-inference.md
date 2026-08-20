---
title: "Schema & type inference (Drizzle, 14 namespaces)"
description: "Drizzle table definitions split across 14 pgSchema() namespaces and re-exported from a single schema index for compile-time type inference."
category: "Databases & Storage"
---

# Schema & type inference (Drizzle, 14 namespaces)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Neon Postgres)

Drizzle table definitions split across 14 pgSchema() namespaces and re-exported from a single schema index for compile-time type inference.

**When to use:** Use when adding or changing database tables and query results need to stay type-safe end to end.

## Docs

- [docs/blueprint/db/relational.md](/docs/blueprint/db/relational) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/db/relational.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/db/relational.md))
- [docs/stack/data/drizzle.md](/docs/stack/drizzle) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/data/drizzle.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/data/drizzle.md))

## Code

- `src/lib/server/db/schema/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/schema) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/schema))

## Proof

- [`/showcases/db/relational/types`](/showcases/db/relational/types)

---

_Machine-readable record: `databases-schema-type-inference` in `mcp/patterns.registry.json`._
