# Backend Jobs Architecture

Background work in the application falls into two categories distinguished by **trigger mechanism**, not code structure. The execution, logging, and monitoring are identical — what varies is how and why a job starts.

---

## Terminology

| Term | Definition | Input | Example |
|------|-----------|-------|---------|
| **Scheduled job** | Runs on a fixed cadence | None | `session-cleanup`, `log-cleanup` |
| **Manual job** | Triggered by an admin | None | Force token refresh, re-run a cleanup |

Both are "jobs." The trigger varies. The job does not.

---

## Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │       JOB REGISTRY           │
                         │   $lib/server/jobs/index.ts  │
                         │                              │
                         │  slug → { execute fn }       │
                         └──────────────┬───────────────┘
                                        │
              ┌─────────────────────────┴──────────────────────────┐
              │                                                     │
    ┌─────────▼──────────┐                            ┌─────────────▼───────┐
    │   SCHEDULED         │                            │   MANUAL            │
    │                     │                            │                     │
    │  Platform adapter:  │                            │  Admin form action: │
    │  • Vercel Cron      │                            │  /admin/jobs        │
    │  • setInterval      │                            │                     │
    │  • External HTTP    │                            │  requireAdmin()     │
    │                     │                            │  → runJob()         │
    └─────────┬───────────┘                            └─────────┬───────────┘
              │                                                  │
              ▼                                                  ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         runJob()                                        │
    │                    Execution wrapper + job_execution table              │
    └──────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         DOMAIN MODULES                                  │
    │                    $lib/server/[domain]/                                │
    │              (same functions serve all trigger types)                   │
    └─────────────────────────────────────────────────────────────────────────┘
```

This extends the multi-client core pattern from `multi-client-core.md` — scheduled and manual triggers are adapters alongside form actions, REST API, and AI tools.

---

## Vendor-Agnostic Scheduling

**Principle: the registry owns the job. The platform owns the schedule.**

The registry maps a slug to an `execute` function — nothing more. Cadence lives in platform config (`vercel.json` crons on Vercel, a flat interval on persistent platforms). Switching hosting platforms requires zero job code changes; only the schedule source moves.

### How It Works

```
Job Registry (slug → execute fn)
         │
         ├── Vercel adapter:     vercel.json crons → GET /api/cron/[job]
         ├── Persistent adapter: setInterval runs every job on a flat cadence
         └── External adapter:   any HTTP cron service calls /api/cron/[job]
```

### The Three Triggering Strategies

**Strategy A: Vercel Cron (serverless platforms)**

Vercel sends an HTTP GET to `/api/cron/[job]` on the schedule defined in `vercel.json`. The endpoint validates the bearer token, looks up the job, and calls `runJob()`. Schedules live in `vercel.json` only — the registry has no `schedule` field to read.

```json
{
  "crons": [
    { "path": "/api/cron/session-cleanup", "schedule": "0 3 * * *" },
    { "path": "/api/cron/log-cleanup", "schedule": "0 4 * * 0" },
    { "path": "/api/cron/analytics-cleanup", "schedule": "0 2 * * *" },
    { "path": "/api/cron/analytics-rollup", "schedule": "30 2 * * *" },
    { "path": "/api/cron/dbops-refresh", "schedule": "0 4 * * *" },
    { "path": "/api/cron/dbops-reaper", "schedule": "0 5 * * *" },
    { "path": "/api/cron/notification-cleanup", "schedule": "15 3 * * *" },
    { "path": "/api/cron/telegram-token-cleanup", "schedule": "30 3 * * *" },
    { "path": "/api/cron/grant-request-expiry", "schedule": "45 3 * * *" },
    { "path": "/api/cron/discord-token-refresh", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/desk-rawrag-sync", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/desk-retention", "schedule": "0 6 * * 0" },
    { "path": "/api/cron/ai-telemetry-retention", "schedule": "30 6 * * 0" },
    { "path": "/api/cron/audit-log-retention", "schedule": "0 7 * * 0" }
  ]
}
```

> **Every registered job needs a `vercel.json` cron.** A slug with no entry never fires on Vercel — the registry does not imply a schedule. Earlier only 6 of 11 jobs were scheduled, so `desk-rawrag-sync`, `grant-request-expiry`, `notification-cleanup`, and the two token jobs silently never ran in production. All jobs now carry a cron.

**Strategy B: Persistent scheduler (containers, VPS, Fly, Railway)**

`scheduler.ts` runs **every** job on a single flat interval — there is no per-job cron parsing. No `vercel.json` needed. No HTTP round-trip — jobs execute in-process.

```typescript
// scheduler.ts — persistent platforms only
function runAll() {
  for (const slug of Object.keys(jobs)) {
    runJob(slug, 'scheduler');
  }
}

if (!building && platform.persistent && !globalThis.__v10r_scheduler) {
  setTimeout(runAll, JOB_STARTUP_DELAY_MS);
  const timer = setInterval(runAll, DEFAULT_JOB_INTERVAL_MS); // 3h default
  timer.unref();
  globalThis.__v10r_scheduler = timer;
  process.on('SIGTERM', () => clearInterval(timer));
}
```

The platform detection (`platform.persistent`) gates activation — on Vercel, this code never runs. `timer.unref()` keeps the interval from blocking process exit; the `SIGTERM` handler clears it on shutdown.

**Strategy C: External HTTP cron (any platform)**

The `/api/cron/[job]` endpoint is already platform-agnostic. Any HTTP client that passes the bearer token can trigger any registered job. This works with external cron services (cron-job.org, EasyCron, GitHub Actions scheduled workflows) as a universal fallback.

### Migration Between Platforms

| From → To | What Changes | What Stays |
|-----------|-------------|------------|
| Vercel → Fly/Railway | Delete `vercel.json` crons. Scheduler activates automatically. | Job registry, runner, domain functions |
| Vercel → Cloudflare | Replace `vercel.json` with Cloudflare cron triggers. Or use external HTTP cron. | Job registry, runner, domain functions |
| Container → Vercel | Add `vercel.json` crons. Scheduler auto-disables (`platform.persistent === false`). | Job registry, runner, domain functions |
| Any → External cron | Point the service at `/api/cron/[job]` with bearer token. | Everything |

---

## Module Structure

```
src/lib/server/
  jobs/                             ← Scheduled + Manual jobs
    index.ts                        ← Registry: slug → { execute }
    runner.ts                       ← runJob(slug, trigger) — execute + log
    scheduler.ts                    ← Flat-interval scheduler for persistent platforms
    delivery-scheduler.ts           ← Fast-interval notification delivery
    session-cleanup.ts
    log-cleanup.ts
    notification-cleanup.ts
    notification-delivery.ts
    telegram-token-cleanup.ts
    discord-token-refresh.ts
    analytics-cleanup.ts
    analytics-rollup.ts
    grant-request-expiry.ts
    dbops-refresh.ts
    dbops-reaper.ts
    desk-rawrag-sync.ts
    desk-retention.ts
    ai-telemetry-retention.ts
    audit-log-retention.ts

src/routes/
  api/
    cron/[job]/+server.ts           ← Vercel cron + external HTTP trigger
  [[locale=locale]]/
    admin/jobs/                     ← Admin UI for job management
      +page.server.ts               ← List + trigger (form actions)
      +page.svelte
```

---

## Job Registry

The registry is the single source of truth for all scheduled and manual jobs. Each entry maps a slug to an `execute` function returning a result count — no metadata. Cadence lives in `vercel.json`, not here.

```typescript
// src/lib/server/jobs/index.ts

export interface Job {
  execute: () => Promise<number>;
}

export const jobs: Record<string, Job> = {
  'session-cleanup': { execute: sessionCleanup },
  'log-cleanup': { execute: logCleanup },
  'notification-cleanup': { execute: notificationCleanup },
  'telegram-token-cleanup': { execute: telegramTokenCleanup },
  'discord-token-refresh': { execute: discordTokenRefresh },
  'analytics-cleanup': { execute: analyticsCleanup },
  'analytics-rollup': { execute: analyticsRollup },
  'grant-request-expiry': { execute: grantRequestExpiry },
  'dbops-refresh': { execute: dbopsRefresh },
  'dbops-reaper': { execute: dbopsReaper },
  'desk-rawrag-sync': { execute: deskRawragSync },
  'desk-retention': { execute: deskRetention },
  'ai-telemetry-retention': { execute: aiTelemetryRetention },
  'audit-log-retention': { execute: auditLogRetention },
};
```

The slug is the only identifier — it keys the registry, the `vercel.json` cron path, and the `job_slug` column in `job_execution`. Which slugs run on a cron, and when, is defined entirely in `vercel.json`.

---

## Retention Jobs

Three scheduled jobs enforce data-retention windows. Each hard-deletes rows past a max age; all are idempotent and safe to re-run.

| Job | Trims | Window |
|-----|-------|--------|
| `desk-retention` | Soft-deleted desk files (cascades to spreadsheet + markdown bodies); prunes `file_revision` history | `DESK_SOFT_DELETE_RETENTION_DAYS` (30d) for files; 90d for revisions |
| `ai-telemetry-retention` | `ai.conversation_step` rows | 180d |
| `audit-log-retention` | `admin.audit_log` rows | 365d |

`desk-retention` is the hard-delete tail of the desk soft-delete lifecycle: a file soft-deleted by a user is purged only after the retention window, then its typed body rows are cascaded.

---

## Execution and Observability

### The Runner

`runJob(slug, trigger)` wraps any job execution with timing, error capture, and logging. It serves scheduled and manual triggers. It returns a `JobResult` object — `{ slug, status, durationMs, resultCount, errorMessage }` — not a bare count.

Logging is inlined in `runJob()` (`runner.ts`): a fire-and-forget `db.insert(jobExecution)` whose failure never masks the job outcome. This is the only logging path — there is no separate logging utility.

The runner writes to `jobs.job_execution` — an immutable event log:

```
jobs.job_execution
├── id              integer     ← generated identity PK
├── job_slug        text        ← registry slug
├── status          enum        ← 'success' | 'failure'
├── trigger         enum        ← 'cron' | 'scheduler' | 'manual'
├── started_at      timestamptz
├── finished_at     timestamptz
├── duration_ms     integer
├── result_count    integer?    ← job-specific metric (rows deleted, emails sent)
└── error_message   text?       ← sanitized error on failure
```

---

## Manual Jobs (Admin UI)

Manual jobs use the same `runJob()` path as scheduled jobs. The difference is the trigger source: an authenticated admin action instead of a cron schedule.

### Route Pattern

The admin job UI lives at `/admin/jobs` (`src/routes/[[locale=locale]]/admin/jobs/`) and uses SvelteKit form actions, not REST API endpoints. Both `load` and the `trigger` action call `requireAdmin(locals)`. After running the job, the action records an audit event so manual triggers are attributable.

```typescript
// src/routes/[[locale=locale]]/admin/jobs/+page.server.ts
export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals);
  // List registered job slugs + per-job stats + paginated execution history
};

export const actions: Actions = {
  trigger: async (event) => {
    requireAdmin(event.locals);
    const slug = (await event.request.formData()).get('slug');
    if (typeof slug !== 'string' || !jobs[slug]) return fail(400, { message: `Unknown job: ${slug}` });

    const result = await runJob(slug, 'manual');

    const ctx = getAuditContext(event);
    await recordAuditEvent({
      ...ctx,
      action: 'job.trigger',
      targetType: 'job',
      targetId: slug,
      detail: { status: result.status, durationMs: result.durationMs, resultCount: result.resultCount },
    });

    return result.status === 'failure'
      ? fail(500, { message: result.errorMessage })
      : { success: true };
  },
};
```

---

## Platform Constraints

### Vercel (Serverless)

| Constraint | Value | Impact |
|-----------|-------|--------|
| Max function duration | 300s (Pro), 800s (Pro + Fluid Compute) | Jobs must complete within this window |
| Cron minimum frequency | 1/minute (Pro), 1/day (Hobby) | Sub-minute cadence not available |
| Cron delivery | At-least-once | Jobs must be idempotent |
| Cron retries | None | Runner logs failures; external alerting required |
| Cron environment | Production only | No cron in preview deployments |
| Cron redirects | Not followed | Route path in `vercel.json` must match exactly |

### Persistent Platforms (Container, Fly, Railway)

| Constraint | Value | Impact |
|-----------|-------|--------|
| Process lifetime | Indefinite | Scheduler runs in-process, no HTTP overhead |
| Cold start | One-time | Scheduler starts once, survives requests |
| Compute suspension | Platform-specific (Neon suspends after 5min idle) | Handle `Connection terminated unexpectedly` |

### Neon PostgreSQL

- **Use direct connection** (port 5432) for any job that uses advisory locks or LISTEN/NOTIFY
- **Pooled connection** (port 6432, PgBouncer transaction mode) breaks session-level features silently
- **Compute suspension** after 5 minutes of inactivity kills existing TCP connections

---

## Security

### Authentication Per Trigger Type

| Trigger | Auth Mechanism | Guard |
|---------|---------------|-------|
| Vercel Cron | `CRON_SECRET` bearer token (timing-safe) | In cron endpoint |
| External HTTP cron | Same bearer token | In cron endpoint |
| Persistent scheduler | None — in-process, trusted | Platform detection gates activation |
| Admin manual | Session cookie + `requireAdmin()` | In form action |

### Hardening Checklist

- **Idempotency**: All scheduled jobs must produce the same outcome whether run once or twice. Use upserts or check-before-act patterns.
- **Concurrency control**: If a job takes longer than its interval, use PostgreSQL advisory locks to prevent parallel execution.
- **Error sanitization**: Strip database URLs, tokens, and API keys from error messages before storing in `job_execution`.
- **Rate limiting**: Cron endpoints should be rate-limited (5/hour per job slug). Admin trigger actions should be rate-limited (3/minute per admin).
- **Audit logging**: Manual job triggers should log the admin user ID alongside the execution record.
- **Response redaction**: The cron endpoint should return only status and timing, not error messages.

---

## `waitUntil` for Fire-and-Forget Side Effects

For non-critical work that should not block the response (analytics, cache invalidation), use `waitUntil` from `@vercel/functions`. This is NOT a job system — it has no retries, no logging, and silently drops failures.

```typescript
import { platform } from '$lib/server/platform';

// Only available on Vercel — conditional import
if (platform.id === 'vercel') {
  const { waitUntil } = await import('@vercel/functions');
  waitUntil(
    invalidateCache(key).catch(err => console.error('[cache]', err))
  );
}
```

Rules:
- Always `.catch()` inside the promise — unhandled rejections are silently lost
- Never use for work where failure matters (emails, data mutations, billing)
- Guard the import with platform detection — `@vercel/functions` only exists on Vercel

---

## Trigger Type

The `job_trigger` enum and the `TriggerType` in `runner.ts` are exactly three values:

```typescript
export type TriggerType = 'cron' | 'scheduler' | 'manual';
```

- `cron` — Vercel cron or external HTTP cron hit `/api/cron/[job]`.
- `scheduler` — the in-process `setInterval` scheduler on persistent platforms.
- `manual` — an admin triggers the job from `/admin/jobs`.

---

## Technology Decision Record

### Chosen

| Tool | Role | Why |
|------|------|-----|
| **Vercel Cron** | Scheduled job trigger (serverless) | Zero cost, zero infra, already working |
| **`setInterval`** | Scheduler (persistent platforms) | Flat interval over all jobs, zero deps |
| **`runJob()` + form actions** | Manual job trigger | Existing pattern, admin UI with progressive enhancement |

### Rejected

| Tool | Why Not |
|------|---------|
| **BullMQ** | Requires persistent Redis connection. Incompatible with serverless. |
| **pg-boss** | Neon PgBouncer breaks LISTEN/NOTIFY and advisory locks silently. Worker is just cron polling (up to 60s delay). |
| **graphile-worker** | Memory leaks reported with Bun. Not officially supported on Bun. |
| **Trigger.dev v3** | CLI requires Node.js (friction in Bun-first project). Experimental Bun runtime has broken OpenTelemetry. |

### Known Tradeoffs

- **The persistent scheduler runs every job on one flat interval** — there is no per-job cron parsing off-Vercel. Adopt a cron library (e.g. `croner`) only if persistent deployment needs distinct per-job schedules.
- **`vercel.json` is the only schedule source on Vercel** and is maintained by hand. The registry holds no schedule, so the two cannot drift on cadence — only on which slugs exist.

---

## References

| Source | Relevance |
|--------|-----------|
| [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) | Cron configuration, at-least-once delivery, production-only |
| [Vercel `waitUntil`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil) | Fire-and-forget semantics, timeout behavior |
| [pg-boss Serverless Pattern](https://github.com/timgit/pg-boss/discussions/403) | Maintainer-recommended `supervise: false` for serverless |
| [SvelteKit `init` Hook Gotcha](https://github.com/sveltejs/kit/issues/13347) | Runs on every cold start on Vercel, not truly once |
| [multi-client-core.md](./multi-client-core.md) | The adapter/domain pattern this document extends |
