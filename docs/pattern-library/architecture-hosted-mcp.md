---
title: "Hosted MCP"
description: "Serves the pattern registry and a separate demo-state service over HTTP through distinct trust boundaries — an unauthenticated public endpoint, a bearer-gated…"
category: "Architecture & Request Pipeline"
---

# Hosted MCP

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Serves the pattern registry and a separate demo-state service over HTTP through distinct trust boundaries — an unauthenticated public endpoint, a bearer-gated private pattern endpoint and a bearer-gated admin endpoint, plus the protected admin page.

**When to use:** Reach for it when exposing an MCP tool registry over HTTP with differing authentication and telemetry requirements per surface.

**Needs:** required key-value-store · v10r's implementation uses relational-db

## Docs

- [docs/blueprint/architecture/hosted-mcp.md](/docs/blueprint/architecture/hosted-mcp) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/hosted-mcp.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/hosted-mcp.md))

## Code

- `src/lib/server/mcp/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/mcp) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/mcp))
- `src/routes/api/mcp/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/mcp) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/mcp))

## Proof

- [`/api/mcp/public`](/api/mcp/public) (app route, no showcase) — POST
- [`/admin/mcp`](/admin/mcp) (app route, no showcase)

---

_Machine-readable record: `architecture-hosted-mcp` in `pattern-library/registry.json`._
