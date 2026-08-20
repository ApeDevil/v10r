---
title: "Codebase map (\"where does X live\")"
description: "Provides a spatial quick-reference table mapping each kind of code (business logic, route adapters, schemas, components, state) to its canonical directory."
category: "Architecture & Request Pipeline"
---

# Codebase map ("where does X live")

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Maturity:** implemented · **Risk:** low — structural pattern, no external services

Provides a spatial quick-reference table mapping each kind of code (business logic, route adapters, schemas, components, state) to its canonical directory.

**When to use:** Reach for it when deciding where a new file should live or trying to locate an existing concern in the repo.

## Docs

- [docs/codebase-organization.md](/docs/codebase-organization) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/codebase-organization.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/codebase-organization.md))

## Code

- `src/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src))

---

_Machine-readable record: `architecture-codebase-map` in `mcp/patterns.registry.json`._
