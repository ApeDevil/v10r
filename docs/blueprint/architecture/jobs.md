# Backend Jobs Architecture

Background work in the application falls into three categories distinguished by **trigger mechanism**, not code structure. The execution, logging, and monitoring are identical — what varies is how and why a job starts.

---

## Terminology

| Term | Definition | Input | Example |
|------|-----------|-------|---------|
| **Scheduled job** | Runs on a fixed cadence | None | `session-cleanup`, `log-cleanup` |
| **Reactive job** | Triggered by a system event | Event payload | Welcome email on signup, graph indexing on upload |
| **Manual job** | Triggered by an admin | Optional parameters | Re-index documents, force token refresh |

"Reactive" over "event-driven" — less overloaded (avoids confusion with DOM events, event sourcing, message queues).

All three are "jobs." The trigger varies. The job does not.

---

## Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │       JOB REGISTRY           │
                         │   $lib/server/jobs/index.ts  │
                         │                              │
                         │  slug, label, schedule,      │
                         │  trigger type, execute fn    │
                         └──────────────┬───────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              │                         │                          │
    ┌─────────▼──────────┐   ┌─────────▼──────────┐    ┌─────────▼──────────┐
    │   SCHEDULED         │   │   REACTIVE          │    │   MANUAL            │
    │                     │   │                     │    │                     │
    │  Platform adapter:  │   │  Inngest serve:     │    │  Admin form action: │
    │  • Vercel Cron      │   │  /api/inngest       │    │  /app/admin/jobs    │
    │  • setInterval      │   │                     │    │                     │
    │  • External HTTP    │   │  inngest.send()     │    │  requireAdmin()     │
    │                     │   │  → step.run()       │    │  → runJob()         │
    └─────────┬───────────┘   └─────────┬───────────┘    └─────────┬───────────┘
              │                         │                          │
              ▼                         ▼                          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         runJob() / logJobExecution()                    │
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

This extends the multi-client core pattern from `multi-client-core.md`. Reactive jobs via Inngest become the **5th adapter type** alongside form actions, REST API, AI tools, and scheduled jobs.

---

## Vendor-Agnostic Scheduling

**Principle: the job registry owns the schedule. Platform config just reads it.**

Schedules are defined in TypeScript alongside the job they describe, not in platform-specific config files. This means switching hosting platforms requires zero job code changes.

### How It Works

```
Job Registry (source of truth)
  schedule: '0 3 * * *'
         │
         ├── Vercel adapter:     vercel.json crons (derived or manually synced)
         ├── Persistent adapter: croner library parses schedule, fires at correct time
         └── External adapter:   any HTTP cron service calls /api/cron/[job]
```

### The Three Triggering Strategies

**Strategy A: Vercel Cron (serverless platforms)**

Vercel sends an HTTP GET to `/api/cron/[job]` on the schedule defined in `vercel.json`. The endpoint validates the bearer token, looks up the job, and calls `runJob()`.

`vercel.json` must be kept in sync with the registry. The registry is authoritative — if they disagree, the registry is correct.

```json
{
  "crons": [
    { "path": "/api/cron/session-cleanup", "schedule": "0 3 * * *" },
    { "path": "/api/cron/log-cleanup", "schedule": "0 4 * * 0" }
  ]
}
```

**Strategy B: Persistent scheduler (containers, VPS, Fly, Railway)**

A cron parser reads the `schedule` field from the registry and fires jobs at the correct times. No `vercel.json` needed. No HTTP round-trip — jobs execute in-process.

```typescript
// scheduler.ts — persistent platforms only
import { Cron } from 'croner';

for (const [slug, job] of Object.entries(jobs)) {
  if (job.schedule) {
    new Cron(job.schedule, () => runJob(slug, 'scheduler'));
  }
}
```

This replaces the current flat-interval `setInterval` approach with actual cron expression parsing. The platform detection (`platform.persistent`) gates activation — on Vercel, this code never runs.

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
    index.ts                        ← Registry with enriched metadata
    runner.ts                       ← runJob(slug, trigger) — execute + log
    log.ts                          ← logJobExecution() — shared logging utility
    scheduler.ts                    ← Cron-aware scheduler for persistent platforms
    delivery-scheduler.ts           ← Fast-interval notification delivery
    session-cleanup.ts
    log-cleanup.ts
    notification-cleanup.ts
    notification-delivery.ts
    telegram-token-cleanup.ts
    discord-token-refresh.ts

  inngest/                          ← Reactive jobs (separate, NOT inside jobs/)
    client.ts                       ← Inngest client instance
    functions/                      ← One file per reactive job
      index.ts                      ← Barrel export
    index.ts                        ← Exports client + function list

src/routes/
  api/
    cron/[job]/+server.ts           ← Vercel cron + external HTTP trigger
    inngest/+server.ts              ← Inngest serve endpoint
  app/
    admin/jobs/                     ← Admin UI for job management
      +page.server.ts               ← List + trigger (form actions)
      +page.svelte
      [slug]/
        +page.server.ts             ← Per-job execution history
        +page.svelte
```

### Why Inngest Lives Outside `jobs/`

Inngest functions have a fundamentally different contract:

| | Scheduled/Manual | Reactive (Inngest) |
|--|-----------------|-------------------|
| Contract | `() => Promise<number>` | `({ event, step }) => Promise<void>` |
| Execution | Synchronous invocation | HTTP callback-based durable execution |
| Retries | Handled by runner | Per-step, managed by Inngest |
| Input | None or optional params | Typed event payload |
| Registration | `jobs` registry | Inngest `serve()` function array |

Forcing both into one registry would require a painful union type that benefits nobody. They share the `job_execution` table for unified monitoring — that is the right seam.

---

## Job Registry

The registry is the single source of truth for all scheduled and manual jobs.

```typescript
// src/lib/server/jobs/index.ts

export interface Job {
  /** The work to perform. Returns a result count. */
  execute: (payload?: unknown) => Promise<number>;

  /** Human-readable name for the admin UI */
  label: string;

  /** How this job is typically triggered */
  trigger: 'scheduled' | 'manual';

  /** One-sentence description */
  description: string;

  /** Cron expression (scheduled jobs only). UTC timezone. */
  schedule?: string;
}

export const jobs: Record<string, Job> = {
  'session-cleanup': {
    execute: sessionCleanup,
    label: 'Session Cleanup',
    trigger: 'scheduled',
    description: 'Remove expired auth sessions.',
    schedule: '0 3 * * *',
  },
  'log-cleanup': {
    execute: logCleanup,
    label: 'Log Cleanup',
    trigger: 'scheduled',
    description: 'Delete job execution logs older than retention period.',
    schedule: '0 4 * * 0',
  },
  // ...
};
```

The `schedule` field uses standard cron syntax (minute, hour, day-of-month, month, day-of-week). All schedules are UTC. The same expression is used by the persistent scheduler (via cron parser) and must match `vercel.json` on Vercel.

---

## Execution and Observability

### The Runner

`runJob(slug, trigger)` wraps any job execution with timing, error capture, and logging. It serves scheduled, manual, and (optionally) Inngest jobs.

The runner writes to `jobs.job_execution` — an immutable event log:

```
jobs.job_execution
├── job_slug        text        ← registry slug or Inngest function ID
├── status          enum        ← 'success' | 'failure'
├── trigger         enum        ← 'cron' | 'scheduler' | 'manual' | 'inngest'
├── started_at      timestamptz
├── finished_at     timestamptz
├── duration_ms     integer
├── result_count    integer?    ← job-specific metric (rows deleted, emails sent)
└── error_message   text?       ← sanitized error on failure
```

### Shared Logging for Inngest

Inngest functions don't go through `runJob()` (different execution model), but they write to the same `job_execution` table via an extracted `logJobExecution()` utility:

```typescript
// src/lib/server/jobs/log.ts
export async function logJobExecution(params: {
  slug: string;
  trigger: TriggerType;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  resultCount: number | null;
  status: 'success' | 'failure';
  errorMessage: string | null;
}): Promise<void> {
  db.insert(jobExecution)
    .values(params)
    .catch((err) => console.error(`[job-log] Failed to log ${params.slug}:`, err));
}
```

This gives the admin UI a single view of all background work — scheduled, reactive, and manual — regardless of trigger mechanism.

---

## Reactive Jobs (Inngest)

### Why Inngest

For the Vercel + SvelteKit stack, Inngest is the recommended choice for reactive jobs:

- Official SvelteKit serve handler (`inngest/sveltekit`)
- Step-based durable execution — each `step.run()` is a separate Vercel function invocation, sidestepping timeout limits
- Built-in retries per step (not per function)
- Dashboard with run history, step traces, and event payloads
- Free tier: 100K function runs/month

### How It Works

```
User signs up
  → route handler calls inngest.send({ name: 'user/signup', data: { userId } })
    → Inngest cloud receives event
      → Inngest calls back POST /api/inngest with the function to execute
        → step.run('send-welcome', () => sendWelcomeEmail(...))
          → step completes, result persisted by Inngest
        → step.run('create-defaults', () => createDefaultUserData(...))
          → each step is a separate Vercel function invocation
```

### Integration Pattern

```typescript
// src/routes/api/inngest/+server.ts
import { serve } from 'inngest/sveltekit';
import { inngest } from '$lib/server/inngest/client';
import { functions } from '$lib/server/inngest/functions';

const handler = serve({ client: inngest, functions });

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
```

Inngest functions follow the multi-client core pattern — thin adapters calling domain functions:

```typescript
// src/lib/server/inngest/functions/user-welcome.ts
import { inngest } from '../client';
import { NotificationService } from '$lib/server/notifications';

export const userWelcome = inngest.createFunction(
  { id: 'user-welcome', retries: 3 },
  { event: 'user/signup' },
  async ({ event, step }) => {
    await step.run('send-welcome', async () => {
      await NotificationService.send({
        userId: event.data.userId,
        actorId: 'system:welcome',
        type: 'system',
        title: 'Welcome!',
      });
    });
  }
);
```

Domain modules never import from `$lib/server/inngest/`. Events flow outward from adapter boundaries.

### Hooks Integration

The Inngest endpoint needs two accommodations in `hooks.server.ts`:

1. **CSRF exclusion** — Inngest callbacks carry `x-inngest-signature`, not `x-requested-with`. Add `/api/inngest/` to the CSRF path exclusion list.
2. **Session populate** — Inngest callbacks have no session cookie. `sessionPopulate` sets `locals.user = null`, which is correct. No change needed.

Inngest's `serve()` handler verifies the signing key internally — no manual signature verification required.

---

## Manual Jobs (Admin UI)

Manual jobs use the same `runJob()` path as scheduled jobs. The difference is the trigger source: an authenticated admin action instead of a cron schedule.

### Route Pattern

Use SvelteKit form actions at `/app/admin/jobs/`, not REST API endpoints. The `/app/*` route guard handles authentication. The action adds an explicit `requireAdmin()` check.

```typescript
// src/routes/app/admin/jobs/+page.server.ts
export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals);
  // List jobs from registry + recent executions from DB
};

export const actions: Actions = {
  trigger: async ({ request, locals }) => {
    requireAdmin(locals);
    const slug = (await request.formData()).get('slug') as string;
    const result = await runJob(slug, 'manual');
    return { result };
  },
};
```

For jobs that exceed the Vercel function timeout (>300s on Pro), the admin action enqueues to Inngest instead of running synchronously.

---

## Platform Constraints

### Vercel (Serverless)

| Constraint | Value | Impact |
|-----------|-------|--------|
| Max function duration | 300s (Pro), 800s (Pro + Fluid Compute) | Jobs must complete within this window |
| Cron minimum frequency | 1/minute (Pro), 1/day (Hobby) | Use Inngest for sub-minute reactive work |
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
| Inngest callback | Inngest signing key (verified by SDK) | In `serve()` handler |
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

## Database Schema Changes

The `job_trigger` enum needs an additional value for Inngest:

```sql
-- Add 'inngest' to the job_trigger enum
ALTER TYPE jobs.job_trigger ADD VALUE 'inngest';
```

The `TriggerType` in `runner.ts` extends accordingly:

```typescript
export type TriggerType = 'cron' | 'scheduler' | 'manual' | 'inngest';
```

---

## Technology Decision Record

### Chosen

| Tool | Role | Why |
|------|------|-----|
| **Vercel Cron** | Scheduled job trigger (serverless) | Zero cost, zero infra, already working |
| **croner** | Schedule parsing (persistent platforms) | ~3KB, zero deps, replaces flat setInterval |
| **Inngest** | Reactive job orchestration | Official SvelteKit support, step-based durable execution, free tier |
| **`runJob()` + form actions** | Manual job trigger | Existing pattern, admin UI with progressive enhancement |

### Rejected

| Tool | Why Not |
|------|---------|
| **BullMQ** | Requires persistent Redis connection. Incompatible with serverless. |
| **pg-boss** | Neon PgBouncer breaks LISTEN/NOTIFY and advisory locks silently. Worker is just cron polling (up to 60s delay). More operational work than Inngest for same result. |
| **graphile-worker** | Memory leaks reported with Bun. Not officially supported on Bun. |
| **Trigger.dev v3** | CLI requires Node.js (friction in Bun-first project). Experimental Bun runtime has broken OpenTelemetry. Better suited for compute-intensive work if needed later. |

### Known Tradeoffs

- **Inngest is a managed service dependency.** If Inngest has an outage, reactive jobs pause. Acceptable for non-critical workflows. October 2025 incident (multi-day partial outage) is documented precedent.
- **Two registries** (jobs/ and inngest/) means two places to check. Mitigated by the unified `job_execution` table and the admin UI reading from both.
- **`vercel.json` must be synced manually** with registry schedules. A build-time validation script can catch drift.

---

## References

| Source | Relevance |
|--------|-----------|
| [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) | Cron configuration, at-least-once delivery, production-only |
| [Vercel `waitUntil`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil) | Fire-and-forget semantics, timeout behavior |
| [Inngest SvelteKit](https://www.inngest.com/docs/learn/serving-inngest-functions) | Official serve handler, function registration |
| [Inngest Durable Execution](https://www.inngest.com/docs/learn/how-functions-are-executed) | Step memoization, HTTP re-invocation model |
| [Inngest October 2025 Incident](https://www.inngest.com/blog/2025-10-24-october-incident-report) | Production reliability precedent |
| [pg-boss Serverless Pattern](https://github.com/timgit/pg-boss/discussions/403) | Maintainer-recommended `supervise: false` for serverless |
| [SvelteKit `init` Hook Gotcha](https://github.com/sveltejs/kit/issues/13347) | Runs on every cold start on Vercel, not truly once |
| [multi-client-core.md](./multi-client-core.md) | The adapter/domain pattern this document extends |
