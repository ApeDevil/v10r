---
title: "Platform scheduling (Vercel cron vs container `setInterval`)"
description: "Cadence is owned entirely by platform config — vercel.json crons hitting /api/cron/[job] on serverless, or a single flat setInterval scheduler on persistent…"
category: "Jobs & Scheduling"
---

# Platform scheduling (Vercel cron vs container `setInterval`)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Jobs & Scheduling · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — touches deploy config (vercel.json crons) and background execution

Cadence is owned entirely by platform config — vercel.json crons hitting /api/cron/[job] on serverless, or a single flat setInterval scheduler on persistent containers — so the job registry itself never changes when switching hosts.

**When to use:** Use when a job must run on a schedule across more than one hosting target without duplicating scheduling logic per platform.

## Docs

- [docs/blueprint/architecture/jobs.md](/docs/blueprint/architecture/jobs) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/jobs.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/jobs.md))
- [docs/blueprint/deployment.md](/docs/blueprint/deployment) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/deployment.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/deployment.md))

## Code

- `src/lib/server/jobs/scheduler.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/scheduler.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/scheduler.ts))
- `src/routes/api/cron/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/cron) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/cron))
- `vercel.json` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vercel.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vercel.json))

## Proof

- [`/showcases/jobs`](/showcases/jobs)

---

_Machine-readable record: `jobs-platform-scheduling` in `pattern-library/registry.json`._
