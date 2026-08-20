---
title: "Graph traversal"
description: "Runs Cypher traversal queries, such as shortest-path and multi-hop lookups, over the modeled graph."
category: "Databases & Storage"
---

# Graph traversal

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Neo4j Aura)

Runs Cypher traversal queries, such as shortest-path and multi-hop lookups, over the modeled graph.

**When to use:** Use when a feature needs to walk relationships between entities, like related-to queries or navigation paths.

## Docs

- [docs/blueprint/db/graph.md](/docs/blueprint/db/graph) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/db/graph.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/db/graph.md))

## Code

- `src/lib/server/graph/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/graph) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/graph))

## Proof

- [`/showcases/db/graph/traversal`](/showcases/db/graph/traversal)

---

_Machine-readable record: `databases-graph-traversal` in `mcp/patterns.registry.json`._
