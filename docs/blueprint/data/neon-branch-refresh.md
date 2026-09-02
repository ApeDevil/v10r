# Neon Branch Refresh

Reset the `dev` Neon Postgres branch from its parent (`production`) on demand or on a schedule, with a live monitor. Admin-only, surfaced at `/admin/db`. Postgres/Neon only in v1.

**Status:** built, validated (877 tests), and browser-verified live on 2026-06-20 — the refresh is guarded by a confirmation dialog, and one real manual refresh ran end-to-end and reached `succeeded` in ~2.5s (two Neon operations, both `finished`).

This is the data-plane sibling of [drizzle-workflow.md](./drizzle-workflow.md): that doc promotes *schema* upward (dev → prod); this one copies *data* downward (prod → dev).

## Two access planes

Neon exposes two independent channels. The refresh feature needs both, and confusing them is the #1 source of trouble.

| Plane | Endpoint | Auth | Used for |
|-------|----------|------|----------|
| **Data plane** | `postgresql://user:pass@ep-….neon.tech/db` | role password | Run SQL. The app and `db:push` use this. |
| **Control plane** | `https://console.neon.tech/api/v2` (Management API) | Bearer `NEON_API_KEY` | Create / **reset-from-parent** / list branches. |

"Refresh dev from prod" means **reset a branch to its parent's state**. That operation has **no SQL equivalent** — it lives only on the control plane. A connection string is therefore necessary but not sufficient; the feature requires control-plane credentials.

The two planes also use different identifiers. The DSN host is the **endpoint id** (`ep-…`), not the **branch id** (`br-…`) the API needs. Neither the branch id nor the project id can be derived from the DSN. They must be configured explicitly.

## Operations

| Operation | Trigger | Direction |
|-----------|---------|-----------|
| **Manual refresh** | Admin clicks "Refresh dev from prod" on the Mirror tab | prod → dev |
| **Scheduled refresh** | `dbops-refresh` cron (gated, default off) | prod → dev |
| **Monitor** | Mirror tab streams branch status live from the Neon API | read-only |

`/admin/db` is a nested section with three tabs:

- **Observe** — the existing DB-usage monitor (unchanged).
- **Mirror** — the "Refresh dev from prod" button plus a branch-status panel: branch name, age, last reset, branch count vs. the free-tier limit of 10, and storage budget. Shows a "not configured" state when `NEON_API_KEY` is absent. No dev → prod affordance exists.
- **Runs** — paginated refresh history (Operation, Status, Trigger, Actor, Duration, Ops, Time).

**Verified hero flow** (browser test, 2026-06-20): click → toast "Refresh started" → "Running" badge with the button disabled and spinning → "Succeeded" → button re-enabled → branch panel reads "Last reset: just now".

Live progress is **client polling** of the status endpoint (~1.5s interval, visibility-aware, stops on terminal), not SSE. There is no background worker — the poll itself advances the run (see [Architecture](#architecture)).

> The hero button opens a **confirmation dialog** (destructive variant) before anything runs — clicking **Cancel** starts nothing; only the red **Refresh dev branch** confirm fires the reset. The reset is destructive and irreversible. See [Operating notes](#operating-notes).

## Setup

### 1. Environment

Set in `.env` (documented in `.env.example`):

| Variable | Required | Where to find it |
|----------|----------|------------------|
| `NEON_API_KEY` | Yes | Neon Console → Account settings → API keys |
| `NEON_PROJECT_ID` | Yes | Console URL, or `GET /api/v2/projects` |
| `NEON_DEV_BRANCH_ID` | Yes | The `br-…` of the dev branch — Console → Branches → dev |
| `NEON_PARENT_BRANCH_ID` | No | Defaults to the dev branch's own `parent_id` |
| `DBOPS_AUTO_REFRESH_ENABLED` | No | `"true"` enables the scheduled reset. Default `"false"`. |

Until configured, the Mirror and Runs tabs show "not configured"; Observe is unaffected.

> Keep `DBOPS_AUTO_REFRESH_ENABLED` off while actively developing — every refresh overwrites the dev branch with prod's current state. See [Constraints](#constraints).

### 2. Schema

`db:push` creates the `dbops` schema. Run it through the PTY trick for the raw-TTY prompt:

```bash
script -qec "bun run db:push" /dev/null
```

The `dbops` ledger lives wherever the app's `NEON_DATABASE_URL_PROD` points (where the app runs) — **not** on the dev branch being reset. A reset wipes the branch; the run history must survive it.

## Architecture

Two server domains. `neon/` reads and mutates the control plane; `dbops/` orchestrates a refresh as a tracked run.

```
admin/db routes ──▶ dbops/ (orchestrate) ──▶ neon/ (Neon Management API)
                       │
                       ▼
                  dbops.run (Postgres ledger)
```

### `$lib/server/neon/`

The Management-API client. **Sole holder** of `NEON_API_KEY` / `NEON_PROJECT_ID`. Never returns connection strings in any payload.

`listBranches`, `getBranch`, `restoreBranchFromParent`, `getOperation`, `neonConfigured`, `resolveTargets`, `fetchBranchStatus`.

When unconfigured it degrades to `status: 'unavailable'` rather than throwing — the same pattern as `$lib/server/monitoring/upstash.ts`.

### `$lib/server/dbops/`

The operate orchestrator. Depends on the read-only `monitoring/` layer; the reverse import (`monitoring → dbops`) is forbidden.

`startOperation`, `advanceRun`, `listRuns`, `cancelRun`, `reapExpiredRuns`. (`advanceRun` is the poll: it settles a finished run as a side effect, which is why there is no read-only `getRun`.)

**Executor model — lazy-advance-on-poll.** Neon's restore is asynchronous: `restoreBranchFromParent` returns an `operations[]` array, not a finished result. So:

1. `startOperation` fires the restore, records the returned operation ids, and returns immediately as `running`.
2. The status endpoint (`GET .../[id]`) advances the run by polling Neon on each read.
3. The run reaches a terminal status (`succeeded` / `failed`) only when something reads it — a client poll, or the scheduled job.

There is no background worker holding the run open. The poll *is* the executor.

**Concurrency and recovery.** A DB partial-unique index allows only one in-flight refresh at a time. Each run holds a lease; the reaper job sweeps runs whose lease expired (a crash mid-restore) and marks them failed.

### `dbops.run` table

One row per refresh. Mutable `status` (`queued | running | succeeded | failed | canceled`); id prefix `dbr_`. Registered in `drizzle.config.ts` `schemaFilter`.

### API

House `{ data }` / `{ error }` envelope. Admin-guarded, rate-limited, audited.

| Method + Path | Purpose | Status |
|---------------|---------|--------|
| `POST /api/admin/db/ops` | Start a refresh | `202` (started), `200` (idempotent replay) |
| `GET /api/admin/db/ops` | List runs (cursor-paginated) | `200` |
| `GET /api/admin/db/ops/[id]` | Poll one run — **advances it** | `200` |
| `POST /api/admin/db/ops/[id]/cancel` | Cancel a run | `200` |

### Jobs

Both reuse the existing `CRON_SECRET` bearer auth and are registered in `$lib/server/jobs/index.ts` (see [architecture/jobs.md](../architecture/jobs.md)).

| Job | Schedule | Purpose |
|-----|----------|---------|
| `dbops-refresh` | `0 4 * * *` daily | Scheduled auto-reset. Drives `advanceRun` to terminal. **Gated by `DBOPS_AUTO_REFRESH_ENABLED`** (default off). |
| `dbops-reaper` | `*/15 * * * *` | Sweep stuck runs whose lease expired. |

Both run inside the daily `/api/cron/due` sweep (refresh before reaper, by registry order); `/api/cron/dbops-refresh` and `/api/cron/dbops-reaper` remain callable by slug.

## Operating notes

Current operator-facing behavior. Distinct from [Constraints](#constraints), which are fixed platform limits.

- **A refresh is destructive and irreversible.** It replaces **all** data in the dev branch with prod's current state. There is no undo. The dev branch is disposable by design — never keep anything in it you can't lose.
- **Guarded by a confirmation dialog.** The hero button opens a destructive-variant dialog ("Refresh dev from prod?" / "This permanently replaces all data in the dev branch with production's current state. It cannot be undone.") with **Cancel** and a red **Refresh dev branch** confirm. The reset fires only after the confirm — Cancel starts no run.

## Constraints

These are real limits, stated honestly.

- **prod → dev only.** A dev → prod data push is refused. Neon has no native merge, and pushing data upward is an anti-pattern. The only legitimate upward "push" is manual schema promotion via `drizzle-kit push` against the prod DSN — see [drizzle-workflow.md](./drizzle-workflow.md).
- **GDPR: a reset copies real prod data into dev.** No anonymization in v1. Neon's anonymized-branch feature *cannot* reset-to-parent, so it is incompatible with this operation. Deferred, not solved.
- **Scheduled refresh is a footgun.** An auto-reset overwrites everything accumulated in the dev branch since the last refresh. Hence the env gate plus a daily (not hourly) default. Leave it off while developing.
- **Free tier:** 10 branches, 0.5 GB storage, 6-hour point-in-time restore window.
- **Reaper cron needs Vercel Pro.** `*/15` (every 15 min) exceeds Hobby's daily-only cron limit.

## Future (not in v1)

A broader "refresh the whole dev environment" design — Neo4j and R2 alongside Postgres, plus graph rebuild — exists as design only. None of it is built. v1 is Postgres/Neon, one branch, one operation.

## Related

- [drizzle-workflow.md](./drizzle-workflow.md) — schema promotion (dev → prod), the upward sibling
- [../architecture/jobs.md](../architecture/jobs.md) — the job registry and cron model
- [../../stack/data/postgres.md](../../stack/data/postgres.md) — Neon, branching, two-plane access
- [../../stack/ops/deployment.md](../../stack/ops/deployment.md) — crons and environment variables
