---
title: "Jobs & scheduling (registry, runner, platform-owned cadence)"
description: "A slug → {execute, cadence} job registry with a unified runner. The registry owns what runs and how often it is due (daily | weekly); the platform owns only…"
category: "Jobs & Scheduling"
---

# Jobs & scheduling (registry, runner, platform-owned cadence)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Jobs & Scheduling · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — touches deploy config and background execution

A slug → {execute, cadence} job registry with a unified runner. The registry owns what runs and how often it is due (daily | weekly); the platform owns only the clock — one daily /api/cron/due sweep on Vercel, a flat interval on persistent hosts — so switching hosts needs zero job-code change.

**When to use:** Use for any recurring or background work — the registry/runner split keeps jobs testable and host-portable.

**Requires:** postgres

## Avoid when

- The work is a stream of items to claim and retry — that is a queue worker pulling an outbox, not a pushed job
- A non-critical side effect of one request (cache invalidation, analytics) — waitUntil covers it without a registry entry
- Jobs need distinct sub-daily schedules — Vercel Hobby cron fires daily only and the persistent scheduler runs one flat interval

## Alternatives

- **A managed job platform (Inngest, Trigger.dev)** — prefer when the project runs on Node rather than Bun and wants managed retries, step functions and run history more than zero-dependency portability
- **BullMQ over Redis** — prefer when the app runs on a persistent host with a long-lived Redis connection, not serverless
- **waitUntil from @vercel/functions** — prefer when the work is a fire-and-forget side effect of one request whose silent failure is acceptable

## Docs

- [docs/blueprint/architecture/jobs.md](/docs/blueprint/architecture/jobs) — The full pattern including cadence ownership ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/jobs.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/jobs.md))

## Code

- `src/lib/server/jobs/index.ts` — Registry: slug → execute function, nothing more ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/index.ts))
- `src/lib/server/jobs/runner.ts` — runJob() unified runner ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/runner.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/runner.ts))
- `src/lib/server/jobs/scheduler.ts` — Container-mode persistent setInterval scheduler ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/scheduler.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/scheduler.ts))
- `src/routes/api/cron/[job]/+server.ts` — Dynamic Vercel cron entry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/cron/[job]/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/cron/[job]/+server.ts))
- `src/routes/api/cron/due/+server.ts` — The daily sweep: runs jobsDueOn(today) sequentially in registry order ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/cron/due/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/cron/due/+server.ts))
- `vercel.json` — Where cron schedules live ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vercel.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vercel.json))

## Tests

- `src/lib/server/jobs/index.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/index.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/index.test.ts))
- `src/lib/server/jobs/retention.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/retention.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/retention.pglite.test.ts))
- `src/lib/server/jobs/dbops-refresh.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/dbops-refresh.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/dbops-refresh.test.ts))

## Proof

- [`/showcases/jobs`](/showcases/jobs)

## Invariants

- The registry owns the job and its cadence; the platform owns only the clock. A host change moves the clock, never a job.
- Registry insertion order IS the sweep's run order — producers before consumers (digest before delivery, rollup before cleanup).
- A job rides the shared due-jobs sweep unless it is marked `standalone`, which is reserved for work dominated by external fetches that would blow the sweep's function-duration ceiling.
- Every run writes its own `job_execution` row through the one runner, success or failure, so a silent job is visible.
- Cron delivery is at-least-once — jobs must be idempotent.

## Emulation notes

- Jobs are a client of domain modules (multi-client core): a job body should call the same domain functions the UI calls.
- Vercel Hobby rejects sub-daily cron schedules at deploy time, so the serverless clock is one daily wake that asks the registry what is due — not one cron entry per job.
- Weekly retention sweeps filter on absolute age, so a skipped Sunday is repaired by the next one instead of leaving a gap.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `jobs-scheduler` in `pattern-library/registry.json`._
