---
title: "Rollup & cleanup jobs"
description: "Two scheduled jobs aggregate yesterday's events into a daily_page_stats table and enforce per-table retention windows (60-180 days) across the analytics tables."
category: "Analytics"
---

# Rollup & cleanup jobs

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Analytics · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — background job scoped to analytics tables, idempotent

Two scheduled jobs aggregate yesterday's events into a daily_page_stats table and enforce per-table retention windows (60-180 days) across the analytics tables.

**When to use:** Use this pair as the pattern for turning raw event tables into a trend-friendly daily rollup while keeping storage bounded.

## Docs

- [docs/blueprint/architecture/jobs.md](/docs/blueprint/architecture/jobs) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/jobs.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/jobs.md))

## Code

- `src/lib/server/jobs/analytics-rollup.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/analytics-rollup.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/analytics-rollup.ts))
- `src/lib/server/jobs/analytics-cleanup.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/analytics-cleanup.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/analytics-cleanup.ts))

## Tests

- `src/lib/server/jobs/analytics-rollup.test.ts` — Pins the rollup half; the cleanup job shares the registry plumbing ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/analytics-rollup.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/analytics-rollup.test.ts))

---

_Machine-readable record: `analytics-rollup-cleanup` in `mcp/patterns.registry.json`._
