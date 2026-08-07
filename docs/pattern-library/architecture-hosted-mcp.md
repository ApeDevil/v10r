---
title: "Hosted MCP (two trust surfaces: public read-only · bearer admin)"
description: "Serves the pattern registry and a separate demo-state service over HTTP through distinct trust boundaries — an unauthenticated public endpoint and…"
category: "Architecture & Request Pipeline"
---

# Hosted MCP (two trust surfaces: public read-only · bearer admin)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Risk:** low — structural pattern, no external services

Serves the pattern registry and a separate demo-state service over HTTP through distinct trust boundaries — an unauthenticated public endpoint and bearer-token-protected private/admin endpoints.

**When to use:** Reach for it when exposing an MCP tool registry over HTTP with differing authentication and telemetry requirements per surface.

## Docs

- [docs/blueprint/architecture/hosted-mcp.md](/docs/blueprint/architecture/hosted-mcp) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/hosted-mcp.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/hosted-mcp.md))

## Code

- `src/lib/server/mcp/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/mcp) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/mcp))
- `src/routes/api/mcp/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/mcp) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/mcp))

## Proof

- [`POST /api/mcp/public`](/api/mcp/public) (app route, no showcase)
- [`/admin/mcp`](/admin/mcp) (app route, no showcase)

---

_Machine-readable record: `architecture-hosted-mcp` in `mcp/patterns.registry.json`._
