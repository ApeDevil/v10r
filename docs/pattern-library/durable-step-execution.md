---
title: "Durable step execution (claim, lease, fence, receipts)"
description: "Multi-step work that can be killed halfway survives without a workflow engine: a conditional status machine, one claim, a database-clock lease with a reaper…"
category: "Durable Execution"
---

# Durable step execution (claim, lease, fence, receipts)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Durable Execution · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** medium — leases without fences and app-clock leases are the classic failures; both are checked here

Multi-step work that can be killed halfway survives without a workflow engine: a conditional status machine, one claim, a database-clock lease with a reaper, a fence so a stale owner cannot write, and per-step receipts committed with each step's effect.

**When to use:** Use for short, few-step work that outlives a request or can be interrupted — outbox delivery, replaying an approved AI plan, driving an external long-running operation.

**Requires:** postgres

## Avoid when

- The work is one statement — a single transaction is already all-or-nothing
- The run needs long sleeps, fan-out or hundreds of steps — that is where a durable-execution platform earns its cost

## Alternatives

- **A durable-execution platform (Vercel Workflow, Temporal, DBOS)** — prefer when runs sleep for days, fan out, or exceed a few dozen steps — and its run state may live outside your database
- **A queue library with its own worker (pg-boss, Graphile Worker)** — prefer when a long-running worker process is available, which serverless Hobby hosting does not give you

## Docs

- [docs/blueprint/integrity/execution.md#durable-step-execution](/docs/blueprint/integrity/execution) — The shared contract across outbox, approved plans and branch resets — and where each deviates ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/integrity/execution.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/integrity/execution.md))

## Code

- `src/lib/server/notifications/outbox.ts` — SKIP LOCKED claim, attempts as fence, DB-clock backoff, reclaimStaleDeliveries ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/outbox.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/outbox.ts))
- `src/lib/server/db/ai/proposals.ts` — Conditional transitions, DB-clock heartbeat lease, lockExecuting fence, markInterruptedIfStale ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/ai/proposals.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/ai/proposals.ts))
- `src/lib/server/ai/proposals/execute-proposal.ts` — Receipt per step in the step's own transaction; fence checked first ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/proposals/execute-proposal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/proposals/execute-proposal.ts))
- `src/lib/server/dbops/operations.ts` — Idempotency key, one-in-flight, status-guarded transitions, poll-only external effect ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/dbops/operations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/dbops/operations.ts))

## Tests

- `src/lib/server/notifications/outbox.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/outbox.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/outbox.pglite.test.ts))
- `src/lib/server/db/ai/proposals.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/ai/proposals.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/ai/proposals.pglite.test.ts))
- `src/lib/server/ai/proposals/execute-proposal.pglite.test.ts` — Includes the fence: a healed run commits no further step ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/proposals/execute-proposal.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/proposals/execute-proposal.pglite.test.ts))
- `src/lib/server/dbops/operations.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/dbops/operations.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/dbops/operations.pglite.test.ts))

## Invariants

- Every transition is conditional on the state it leaves; matching no row is a lost race, not an error.
- A lease is always paired with a fence — without one a stalled owner commits behind a terminal status.
- A step's receipt commits in the same transaction as its database effect.
- Step identity is stable across retries (a position in a frozen payload or a row id), never a count of calls made.
- A terminal run answers repeats from its receipts and never re-executes.
- External effects are at-least-once unless the API takes an idempotency key — each implementation says which.

## Emulation notes

- Take lease time from the database clock (`now()`), the same clock the claim predicate reads; an instance's Date.now() is a second, skewable opinion.
- Put the fence in the data, not in the platform: Vercel's maxDuration happens to kill a stalled run, a persistent host does not — lock the run row inside each step's transaction and refuse unless it is still yours.
- Never re-issue an external call you cannot key idempotently; poll the operation you started instead (dbops), or accept duplicates explicitly (notifications).
- Heal lazily on read where nothing else needs the slot — a dead run discovered on the next status request needs no extra cron.

---

_Machine-readable record: `durable-step-execution` in `pattern-library/registry.json`._
