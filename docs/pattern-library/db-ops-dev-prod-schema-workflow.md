---
title: "Dev→prod schema workflow (push-only, no migrations dir)"
description: "Uses drizzle-kit push for schema changes during development and defers versioned generate/migrate SQL files until production holds real data."
category: "Database Operations"
---

# Dev→prod schema workflow (push-only, no migrations dir)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Database Operations · **Tier:** light · **Maturity:** implemented · **Risk:** low — dev-time workflow/config, no runtime dependency

Uses drizzle-kit push for schema changes during development and defers versioned generate/migrate SQL files until production holds real data.

**When to use:** Follow this while prototyping solo, then switch to generate+migrate before a production database with real user data goes live.

## Docs

- [docs/blueprint/data/drizzle-workflow.md](/docs/blueprint/data/drizzle-workflow) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/data/drizzle-workflow.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/data/drizzle-workflow.md))

## Code

- `drizzle.config.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/drizzle.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/drizzle.config.ts))

---

_Machine-readable record: `db-ops-dev-prod-schema-workflow` in `mcp/patterns.registry.json`._
