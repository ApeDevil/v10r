---
title: "Pattern MCP (agent-queryable pattern registry, local stdio)"
description: "A read-only local stdio MCP server that exposes v10r's curated pattern registry (docs, code, tests, invariants) to coding agents so they can emulate patterns…"
category: "Architecture & Request Pipeline"
---

# Pattern MCP (agent-queryable pattern registry, local stdio)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — read-only, network-isolated container

A read-only local stdio MCP server that exposes v10r's curated pattern registry (docs, code, tests, invariants) to coding agents so they can emulate patterns instead of grepping.

**When to use:** Reach for it when an agent needs to query or emulate an existing v10r pattern from outside the repo, or when adding a new pattern record.

## Docs

- [docs/blueprint/architecture/pattern-mcp.md](/docs/blueprint/architecture/pattern-mcp) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/pattern-mcp.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/pattern-mcp.md))

## Code

- `mcp/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/mcp) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/mcp))

## Proof

- [`/showcases/mcp`](/showcases/mcp)

---

_Machine-readable record: `architecture-pattern-mcp` in `mcp/patterns.registry.json`._
