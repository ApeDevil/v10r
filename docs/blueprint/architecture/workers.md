# Workers

"Worker" names three unrelated things. This document separates them, then specifies the two that v10r actually runs: a browser Web Worker for CPU offload, and a claim-based queue worker draining the notification outbox.

The showcase is `/showcases/workers`. For scheduled background work — which is **not** a worker — see [jobs.md](./jobs.md).

---

## The three meanings

| Term | What it is | Where it runs | In v10r |
|------|-----------|---------------|---------|
| **Web Worker** | A second JS thread in the browser | Client | `$lib/workers/` — image analysis offload |
| **Queue worker** | A consumer that pulls units of work off a queue | Server | `notificationDelivery()` over the outbox |
| **Service worker** | A network proxy for a PWA | Client | `src/service-worker.ts` — see `docs/blueprint/pwa.md` |

They share a word and nothing else. Service workers proxy fetches; Web Workers run computation; queue workers consume messages.

**The tell:** ask what it consumes. A queue worker consumes from a queue. A Web Worker consumes messages you send it. A service worker consumes `fetch` events. A *job* consumes nothing — it wakes on a timer and runs.

---

## Worker vs job

| | Job | Worker |
|---|-----|--------|
| Is a… | unit of work (a function) | long-lived process |
| Started by | a trigger (cron, scheduler, admin) | itself — it is already running |
| Gets work by | being told which slug to run | pulling from a queue |
| Idle cost | none — does not exist | real — the process is resident |

v10r's jobs are **pushed**: something poked them awake and named the work. The outbox worker **pulls**: it asks the queue what is due. That difference is why one needs a claim and the other does not.

---

## Web Worker — CPU offload

### Module layout

```
src/lib/workers/
  palette.ts                  ← pure: dominantColors(), averageLuminance() — node-testable
  image-analysis.ts           ← browser: decode → OffscreenCanvas downscale → palette
  image-analysis.worker.ts    ← worker shell: onmessage plumbing ONLY
```

The split is the same pure-core/impure-shell convention as `src/service-worker.ts` ↔ `$lib/pwa/sw-policy.ts`, and for the same reason: the vitest harness is node-environment, so `self`, `postMessage`, `OffscreenCanvas`, and `createImageBitmap` cannot be exercised. Anything worth testing must live outside the shell — `palette.test.ts` covers the arithmetic.

`image-analysis.ts` is shared by both execution paths, so the showcase compares *identical work* in two places rather than two implementations.

### Vite configuration

```ts
// vite.config.ts
worker: { format: 'es' },
```

**Required.** Vite defaults worker bundles to `iife`, which cannot carry `import` statements. An ES-module worker therefore works in dev (native ESM, no bundling) and breaks **only in the production build** — the worst possible failure timing. Spawn with the `?worker` suffix:

```ts
import ImageAnalysisWorker from '$lib/workers/image-analysis.worker?worker';
const worker = new ImageAnalysisWorker();
```

### CSP

Already permitted — `svelte.config.js` sets `worker-src: ['self', 'blob:']`. `?worker` emits a same-origin chunk under `/_app/immutable/`; `?worker&inline` produces a `blob:` URL. Both are covered, and neither needs a CSP change.

Note that CSP is **not enforced in dev**, so worker-related CSP breakage would only appear in `vite build && vite preview`.

### Transferables

```ts
worker.postMessage({ id, bytes }, [bytes]);
//                                 ^^^^^^^ transfer list
```

Without the second argument the `ArrayBuffer` is **structured-cloned** — a full copy. With it, ownership moves and the sender's buffer is neutered (`byteLength` becomes 0). On a 20 MB photo this is the difference between a copy and a pointer hand-off, and it is the single most-missed part of the API. Because the buffer is consumed, a caller that runs twice must re-read the bytes from the `File` each time.

### Service worker interaction

None to worry about. `src/service-worker.ts` treats `/_app/immutable/` as cache-first, so a `?worker` chunk is precached on install and boots from cache on repeat visits. An inline (`blob:`) worker is never intercepted at all — the SW early-outs on cross-origin. The `message` handler only understands `SKIP_WAITING` and `FLUSH`, so there is no protocol collision.

---

## Queue worker — the notification outbox

`notifications.notification_deliveries` is a queue table. `notificationDelivery()` is its consumer.

### The claim

```sql
UPDATE notifications.notification_deliveries AS d
SET status = 'processing', attempts = d.attempts + 1, attempted_at = now()
FROM (
    SELECT id FROM notifications.notification_deliveries
    WHERE status = 'pending' AND next_attempt_at <= now()
    ORDER BY next_attempt_at, created_at
    LIMIT $1
    FOR UPDATE SKIP LOCKED
) AS c, notifications.notifications AS n
WHERE d.id = c.id AND n.id = d.notification_id
RETURNING d.id AS "id", d.notification_id AS "notificationId", ...
```

Four constraints shape this statement:

**One statement, not a transaction.** `neonConfig.poolQueryViaFetch` only redirects single stateless `Pool.query()` calls to HTTP; `db.transaction()` takes the WebSocket path Bun mishandles. A single statement is its own transaction, so the subquery's row locks are held exactly as long as the `UPDATE` needs. Same reasoning as `$lib/server/mcp/demo/service.ts`.

**Raw SQL, not the query builder.** The lock clause must be literal and reviewable. PGlite is single-connection, so a silently-dropped `SKIP LOCKED` could never be caught by a test — this is the one place where raw SQL is *safer* than the builder.

**Every `RETURNING` alias is double-quoted.** Unquoted `AS notificationId` is folded by Postgres to `notificationid`. It still type-checks in TypeScript and yields `undefined` on every row at runtime.

**Tables are schema-qualified.** Production runs with the default `search_path` (`public`); only the test harness sets a wide one.

`SKIP LOCKED` means a claimer never blocks, and may return *fewer* than `batchSize` rows under contention — `LIMIT` applies before skipping. That is expected.

### The fence token

`attempts` is incremented by the claim and returned with it. Every terminal write is guarded on `id AND attempts = claim.attempts AND status IN ('processing','pending')`.

This is what makes a reclaimed row safe. If a worker's lease lapses and the reaper requeues the row, a *re-claim* bumps `attempts` — so the original worker's late report no longer matches its fence and is discarded. But if nobody re-claimed it yet, the late report still lands, which is why `'pending'` is in the guard: a worker reporting success after a reap must win, or the notification is sent twice.

### Retry policy

Pure arithmetic in `$lib/server/notifications/backoff.ts`; the delay is applied against the **database** clock (`now() + make_interval(...)`) so a skewed app server cannot shift the queue.

| Outcome | Status | Next |
|---------|--------|------|
| Provider says not retryable | `failed` | terminal — a Retry button would be pointless |
| Retryable, budget remains | `pending` | `now() + backoff(attempts)` with ±15% jitter |
| Retryable, budget spent | `dead` | terminal — surfaces in the admin "Needs Attention" panel |

Curve: 30s → 2m → 8m → 32m, clamped at 1h, over `DELIVERY_MAX_ATTEMPTS` (5) sends.

The `failed`/`dead` split is what makes the admin panel useful rather than merely non-empty: `dead` means a transient fault outlived the budget and a human should look; `failed` means the address is bad and retrying changes nothing.

### The reaper

A row sits in `'processing'` only between the claim and the terminal write. If the process dies in between — SIGKILL, Vercel `maxDuration`, an unhandled throw — nothing else will ever move it.

`reclaimStaleDeliveries()` requeues rows whose `coalesce(attempted_at, created_at)` is older than `DELIVERY_CLAIM_LEASE_MS`, or dead-letters them if the budget is spent. It does **not** bump `attempts` — the claim already counted that attempt.

It runs at the top of `notificationDelivery()`, not as its own registered job, for two reasons: a standalone job would get one **daily** cron slot on Vercel Hobby (sub-daily crons fail the whole deploy), making reclaim latency 24h on the platform where stranding is most likely; and running it inside the drain guard means a process can never reap the batch it is itself working on.

> **Lease invariant:** `DELIVERY_CLAIM_LEASE_MS` must exceed the worst-case time to drain a full batch, because `attempted_at` is stamped once for the whole batch — the last row's lease clock has been running since the claim. The providers have no timeout yet, so this invariant is currently aspirational rather than enforced.

### Platform behaviour

The same code, two very different lives:

| Platform | `platform.persistent` | Drain cadence |
|----------|----------------------|---------------|
| Container / Fly / Railway | `true` | `delivery-scheduler.ts`, every 15s |
| Vercel | `false` | `vercel.json` cron, **once daily** |

On Vercel the worker is dormant between invocations — no process survives the response. This is not a defect to fix; it is why the whole jobs architecture is push-triggered. `/showcases/workers` renders this live from `platform.id`.

The in-process `draining` boolean is **not** a correctness lock — the claim is. It stops one process stacking overlapping drains when a batch outlives the 15s tick, and is a harmless no-op on Vercel where each invocation is a fresh module instance.

---

## Why not BullMQ / pg-boss / graphile-worker

A queue worker in the classical sense needs a resident process. Serverless has none, which is why [jobs.md](./jobs.md) rejects all three. The outbox pattern here is the serverless-compatible substitute: the queue is a table, the "worker" is whatever invocation happens to run the drain, and correctness comes from the atomic claim rather than from process identity.

Specifically: `SKIP LOCKED` is **transaction**-scoped, so unlike advisory locks and `LISTEN/NOTIFY` — both *session*-scoped and silently broken by Neon's PgBouncer — it works through the pooler. That is precisely why this approach is viable where pg-boss was not.

---

## Testing boundary

PGlite is single-connection WASM Postgres. `SKIP LOCKED` parses and executes but **can never actually skip**, so true concurrency is untestable in the harness. What is testable, and covered:

- the claim is a state transition, not a read (a second claim returns nothing)
- a row whose backoff has not elapsed is not claimed
- stale-fence writes are rejected; post-reap success still lands
- the reaper's reclaim window — past the lease yes, within it no
- the `.rows`-vs-array driver split (`$lib/server/db/rows.ts`)

Verify real `SKIP LOCKED` behaviour manually with two `psql` sessions against Neon before trusting it in production.

---

## Follow-ups

- **Provider timeouts.** None of the fetch-based providers sets `AbortSignal.timeout()`. This is what would make the lease invariant real rather than aspirational.
- **Idempotency key.** No unique constraint on `(notification_id, channel)`, so a retried `NotificationService.send()` can duplicate outbox rows.
- **Derived "retrying" label** for the admin log: `status = 'pending' && attempts > 0 && nextAttemptAt > now()`. Zero DDL.

---

## References

| Source | Relevance |
|--------|-----------|
| [`SELECT … FOR UPDATE SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) | Claim semantics, transaction scope |
| [Vite worker options](https://vite.dev/config/worker-options) | `worker.format`, `?worker` suffix |
| [MDN: Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) | Transfer vs structured clone |
| [jobs.md](./jobs.md) | Scheduled/manual triggers — the non-worker half |
| [multi-client-core.md](./multi-client-core.md) | The adapter/domain pattern both extend |
