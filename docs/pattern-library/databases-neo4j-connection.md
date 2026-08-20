---
title: "Neo4j connection (Aura)"
description: "Connects to a managed Neo4j Aura database over its HTTP Query API via fetch, with no driver, session, or connection pool."
category: "Databases & Storage"
---

# Neo4j connection (Aura)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Neo4j Aura)

Connects to a managed Neo4j Aura database over its HTTP Query API via fetch, with no driver, session, or connection pool.

**When to use:** Reach for it when server code needs to execute Cypher queries against the graph store.

## Docs

- [docs/blueprint/db/graph.md](/docs/blueprint/db/graph) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/db/graph.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/db/graph.md))
- [docs/stack/data/neo4j.md](/docs/stack/neo4j) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/data/neo4j.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/data/neo4j.md))

## Code

- `src/lib/server/graph/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/graph) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/graph))

## Proof

- [`/showcases/db/graph/connection`](/showcases/db/graph/connection)

---

_Machine-readable record: `databases-neo4j-connection` in `mcp/patterns.registry.json`._
