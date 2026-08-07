---
title: "Data retention policy & purge jobs"
description: "Scheduled jobs that enforce data-retention policy by purging stale records on a fixed cadence, using the shared backend jobs framework."
category: "Admin & Privacy"
---

# Data retention policy & purge jobs

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Admin & Privacy · **Tier:** light · **Risk:** medium — retention gaps or over-eager purges both carry compliance/data-loss risk

Scheduled jobs that enforce data-retention policy by purging stale records on a fixed cadence, using the shared backend jobs framework.

**When to use:** Use when a new data domain needs an automatic expiry/purge cycle rather than indefinite retention.

## Docs

- [docs/blueprint/architecture/jobs.md](/docs/blueprint/architecture/jobs) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/jobs.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/jobs.md))

## Code

- `src/lib/server/jobs/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/jobs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/jobs))

## Proof

- [`/showcases/privacy/retention`](/showcases/privacy/retention)

---

_Machine-readable record: `admin-privacy-data-retention` in `mcp/patterns.registry.json`._
