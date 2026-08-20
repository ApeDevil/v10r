---
title: "Jobs & scheduling (registry, runner, platform-owned cadence)"
description: "A slug→execute job registry with a unified runner; cadence lives entirely in platform config (Vercel cron vs container setInterval), so switching hosts needs…"
category: "Jobs & Scheduling"
---

# Jobs & scheduling (registry, runner, platform-owned cadence)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Jobs & Scheduling · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — touches deploy config and background execution

A slug→execute job registry with a unified runner; cadence lives entirely in platform config (Vercel cron vs container setInterval), so switching hosts needs zero job-code change.

**When to use:** Use for any recurring or background work — the registry/runner split keeps jobs testable and host-portable.

## Docs

- [docs/blueprint/architecture/jobs.md](/docs/blueprint/architecture/jobs) — The full pattern including cadence ownership ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/jobs.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/jobs.md))

## Code

- `src/lib/server/jobs/index.ts` — Registry: slug → execute function, nothing more ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/index.ts))
- `src/lib/server/jobs/runner.ts` — runJob() unified runner ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/runner.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/runner.ts))
- `src/lib/server/jobs/scheduler.ts` — Container-mode persistent setInterval scheduler ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/scheduler.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/scheduler.ts))
- `src/routes/api/cron/[job]/+server.ts` — Dynamic Vercel cron entry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/cron/[job]/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/cron/[job]/+server.ts))
- `vercel.json` — Where cron schedules live ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vercel.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vercel.json))

## Tests

- `src/lib/server/jobs/retention.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/retention.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/retention.test.ts))
- `src/lib/server/jobs/dbops-refresh.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/dbops-refresh.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/dbops-refresh.test.ts))

## Proof

- [`/showcases/jobs`](/showcases/jobs)

## Invariants

- The registry maps a slug to an execute function — nothing more; cadence lives in platform config, the registry has no schedule field.
- Every registered job needs a vercel.json cron entry — a slug with no entry never fires.
- Cron delivery is at-least-once — jobs must be idempotent.

## Emulation notes

- Jobs are a client of domain modules (multi-client core): a job body should call the same domain functions the UI calls.
- Vercel Hobby tier rejects sub-daily cron schedules at deploy time — plan cadence accordingly.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `jobs-scheduler` in `mcp/patterns.registry.json`._
