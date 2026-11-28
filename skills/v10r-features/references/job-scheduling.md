# Jobs and scheduling

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** Jobs & Scheduling · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — touches deploy config and background execution

A slug → {execute, cadence} job registry with a unified runner. The registry owns what runs and how often it is due (daily | weekly); the platform owns only the clock — one daily /api/cron/due sweep on Vercel, a flat interval on persistent hosts — so switching hosts needs zero job-code change.

**When to use:** Use for any recurring or background work — the registry/runner split keeps jobs testable and host-portable.

**Needs:** required relational-db, scheduler · v10r's implementation uses object-storage

## Avoid when

- The work is a stream of items to claim and retry — that is a queue worker pulling an outbox, not a pushed job
- A non-critical side effect of one request (cache invalidation, analytics) — waitUntil covers it without a registry entry
- Jobs need distinct sub-daily schedules — Vercel Hobby cron fires daily only and the persistent scheduler runs one flat interval

## Alternatives

- **A managed job platform (Inngest, Trigger.dev)** — prefer when the project runs on Node rather than Bun and wants managed retries, step functions and run history more than zero-dependency portability
- **BullMQ over Redis** — prefer when the app runs on a persistent host with a long-lived Redis connection, not serverless
- **waitUntil from @vercel/functions** — prefer when the work is a fire-and-forget side effect of one request whose silent failure is acceptable

## Docs

- `docs/blueprint/architecture/jobs.md` — The full pattern including cadence ownership ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/jobs.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/jobs.md))
- `docs/blueprint/deployment.md` — Platform scheduling — Cadence is owned entirely by platform config — vercel.json crons hitting /api/cron/[job] on serverless, or a single flat setInterval scheduler on persistent containers — so the job registry itself never changes when switching hosts. Use when a job must run on a schedule across more than one hosting target without duplicating scheduling logic per platform. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/deployment.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/deployment.md))

## Code

- `src/lib/server/jobs/index.ts` — Registry: slug → execute function, nothing more ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/index.ts))
- `src/lib/server/jobs/runner.ts` — runJob() unified runner ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/runner.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/runner.ts))
- `src/lib/server/jobs/scheduler.ts` — Container-mode persistent setInterval scheduler ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/scheduler.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/scheduler.ts))
- `src/routes/api/cron/[job]/+server.ts` — Dynamic Vercel cron entry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/cron/[job]/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/cron/[job]/+server.ts))
- `src/routes/api/cron/due/+server.ts` — The daily sweep: runs jobsDueOn(today) sequentially in registry order ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/cron/due/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/cron/due/+server.ts))
- `vercel.json` — Where cron schedules live ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vercel.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vercel.json))
- `src/routes/api/cron/` — Platform scheduling ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/cron) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/cron))
- `src/lib/server/jobs/` — Registered jobs — The concrete job implementations — retention sweeps, cleanup, external sync, and delivery — are idempotent slug-keyed functions run by the shared runner and manageable from an admin UI. Use this catalog as the template when adding a new retention, cleanup, sync, or delivery job to the registry. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/jobs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/jobs))

## Tests

- `src/lib/server/jobs/index.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/index.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/index.test.ts))
- `src/lib/server/jobs/retention.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/retention.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/retention.pglite.test.ts))
- `src/lib/server/jobs/dbops-refresh.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/dbops-refresh.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/dbops-refresh.test.ts))

## Proof

- [`/showcases/jobs`](https://www.v10r.dev/showcases/jobs)
- `/admin/jobs` (app route, no showcase) — Registered jobs

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

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/multi-client-core.md) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Built on by**

- [Data retention policy & purge jobs](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/data-retention.md)
- [Rollup & cleanup jobs](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/analytics-rollups.md)
- [Encryption key ring](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/encryption-key-ring.md)


---

_Machine-readable record: `job-scheduling` in `pattern-library/registry.json`._
