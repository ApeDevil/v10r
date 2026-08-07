---
title: "Polyglot freshness (Postgres ↔ Neo4j sync)"
description: "Documents strategies for keeping references between Postgres and Neo4j valid, since no foreign keys exist across the two stores."
category: "Databases & Storage"
---

# Polyglot freshness (Postgres ↔ Neo4j sync)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Risk:** medium — spans two external managed services (Postgres, Neo4j)

Documents strategies for keeping references between Postgres and Neo4j valid, since no foreign keys exist across the two stores.

**When to use:** Apply when a delete or update in one store, such as a Postgres user or item, must propagate to or invalidate related Neo4j nodes.

## Docs

- [docs/blueprint/db/polyglot-freshness.md](/docs/blueprint/db/polyglot-freshness) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/db/polyglot-freshness.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/db/polyglot-freshness.md))

## Code

- `src/lib/server/graph/catalog.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/graph/catalog.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/graph/catalog.ts))

---

_Machine-readable record: `databases-polyglot-freshness` in `mcp/patterns.registry.json`._
