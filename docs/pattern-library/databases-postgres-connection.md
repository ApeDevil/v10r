---
title: "Postgres client & connection (Neon serverless)"
description: "Sets up the Drizzle client for PostgreSQL using the Neon serverless driver as the app's single database connection entrypoint."
category: "Databases & Storage"
---

# Postgres client & connection (Neon serverless)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Neon Postgres)

Sets up the Drizzle client for PostgreSQL using the Neon serverless driver as the app's single database connection entrypoint.

**When to use:** Reach for it whenever server-side code needs a database handle to run Drizzle queries.

## Docs

- [docs/blueprint/db/relational.md](/docs/blueprint/db/relational) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/db/relational.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/db/relational.md))
- [docs/stack/data/postgres.md](/docs/stack/postgres) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/data/postgres.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/data/postgres.md))

## Code

- `src/lib/server/db/index.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/index.ts))

## Proof

- [`/showcases/db/relational/connection`](/showcases/db/relational/connection)

---

_Machine-readable record: `databases-postgres-connection` in `mcp/patterns.registry.json`._
