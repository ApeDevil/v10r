# Notification Routing

Backend architecture for multi-channel notification delivery.

**Runtime model:** Container-first (persistent Bun process), with Vercel serverless as compatible fallback.

---

## Routing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NotificationService.send()                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: { userId, type, title, body, entityRef?, actionUrl?, groupKey? }    │
│                                                                              │
│  1. Create in-app notification record (always)                              │
│  2. Load user settings + connected channels                                  │
│  3. Apply routing rules:                                                     │
│     - Security type → force email (cannot disable)                          │
│     - Check settings matrix for each channel                                │
│     - Skip disconnected/inactive channels                                   │
│  4. Create delivery records in outbox                                       │
│  5. routeExternal (fire-and-forget) writes outbox records:                  │
│     - Container: in-process worker polls and delivers                       │
│     - Vercel: /api/cron/[job] sweep delivers pending records                │
│                                                                              │
│  Output: { notificationId, queuedChannels[] }                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Provider Interface

Each channel provider implements a common interface:

| Method | Purpose |
|--------|---------|
| `send(delivery)` | Send notification, return result |
| `validateConnection(userId)` | Check if channel is usable |
| `getProviderName()` | Return provider identifier |

### Delivery Result

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `sent`, `failed`, `skipped` |
| `externalId` | string? | Provider's message ID |
| `error` | string? | Error message if failed |
| `retryable` | boolean | Whether to retry on failure |

---

## Provider Implementations

### Email Provider (Resend)

| Aspect | Detail |
|--------|--------|
| **SDK** | `resend` npm package |
| **Rate limit** | 100/day free tier, 50K/mo on Pro |
| **Failure modes** | Bounce, spam block, invalid address |
| **Retry strategy** | 3 attempts with exponential backoff |

### Telegram Provider (Bot API via fetch)

| Aspect | Detail |
|--------|--------|
| **SDK** | Raw `fetch()` to `https://api.telegram.org/bot<TOKEN>/sendMessage`. No framework needed for outbound-only. Add grammY only if bidirectional bot commands required. |
| **Rate limit** | 30 msg/sec global, ~1 msg/sec per chat |
| **Failure modes** | Bot blocked, chat not found, rate limited |
| **Retry strategy** | Retry on 429, mark inactive on 403 |

### Discord Provider

| Aspect | Detail |
|--------|--------|
| **SDK** | Direct REST API calls |
| **Rate limit** | Dynamic, parse from response headers |
| **Failure modes** | Token expired, DMs disabled, rate limited |
| **Retry strategy** | Refresh token on 401, retry on 429 |

**Critical:** Discord rate limits are NOT hard-coded. Always parse:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### Web Push Provider

| Aspect | Detail |
|--------|--------|
| **SDK** | `web-push` npm package (VAPID) |
| **Fan-out** | `payload.to` is the v10r user id, not an endpoint — the provider loads every `push_subscriptions` row for that user and sends one payload per device |
| **Payload** | Declarative Web Push JSON: `{ web_push: 8030, notification: { title, body, navigate, lang } }` — no PII (title = brand name, body = a generic category line) |
| **Failure modes** | Push service returns 404/410 for a dead endpoint |
| **Retry strategy** | None — see [Web Push Bypasses the Outbox](#web-push-bypasses-the-outbox) below |

Unlike the other three providers, Web Push never goes through the outbox — see below.

---

## Rate Limiting Strategy

### Per-Provider Limits

| Provider | Window | Max Requests | On Limit |
|----------|--------|--------------|----------|
| Resend | 1 day | 100 (free) | Queue for next day |
| Telegram | 1 second | 30 global | Backoff + retry |
| Discord | Dynamic | From headers | Respect `Retry-After` |

### Implementation Options

| Approach | Runtime | Pros | Cons |
|----------|---------|------|------|
| **In-process tracker** | Container | Zero deps, in-memory, fast | Lost on restart |
| **Database-backed** | Both | Persistent, no external deps | Adds DB queries |
| **Inngest built-in** | Vercel | Zero config, per-step limits | Requires Inngest |
| **Upstash Redis** | Both | Fast, distributed, survives restarts | Another service |

**Recommendation:** Database-backed rate tracking for container (simple, persistent). Inngest's `rateLimit` for Vercel deployments. Both use the same outbox table.

---

## Outbox Pattern

Store pending deliveries in database before async processing:

```
Container runtime:
┌─────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Sync       │────▶│ notification_       │────▶│  In-process      │
│  Handler    │     │ deliveries (outbox) │     │  Worker          │
└─────────────┘     └─────────────────────┘     │  (setInterval)   │
      │                       │                  └──────────────────┘
      ▼                       ▼                       │
 In-app notif           Delivery          External providers
   created              persisted            called async

Vercel serverless:
┌─────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Sync       │────▶│ notification_       │────▶│  /api/cron/[job] │
│  Handler    │     │ deliveries (outbox) │     │  sweep           │
└─────────────┘     └─────────────────────┘     └──────────────────┘
```

### Why Outbox?

| Benefit | Explanation |
|---------|-------------|
| **Transactional safety** | Delivery records created in same transaction as notification |
| **Retry from source** | Failed deliveries can be retried from database state |
| **Observability** | Full audit trail of what was sent where |
| **Decoupling** | Request handler doesn't wait for external APIs |
| **Runtime-agnostic** | Same outbox table works regardless of who processes it |

---

## Delivery Processing (Runtime-Adaptive)

The outbox table is the contract. **Who processes it** depends on the runtime.

### Container: In-Process Worker (Primary)

The delivery worker runs on its own `setInterval` in `src/lib/server/jobs/delivery-scheduler.ts` (separate from the 3-hourly `scheduler.ts`). It is gated on `platform.persistent` and ticks at `DEFAULT_DELIVERY_INTERVAL_MS` (15s). The worker logic lives in `src/lib/server/jobs/notification-delivery.ts`:

| Aspect | Detail |
|--------|--------|
| **Trigger** | `setInterval` (15s, `DEFAULT_DELIVERY_INTERVAL_MS`) |
| **Processing** | Atomic claim (`FOR UPDATE SKIP LOCKED`) of `DELIVERY_BATCH_SIZE` due rows |
| **Retry** | Exponential backoff via `next_attempt_at`; dead-lettered when the budget is spent |
| **Recovery** | Stale claims reclaimed after `DELIVERY_CLAIM_LEASE_MS` at the top of each drain |
| **Advantage** | Zero external dependencies, immediate pickup, full control |

The claim, the fence token, and the reaper are specified in [architecture/workers.md](../architecture/workers.md) — this table is only the routing view of them.

`service.ts` calls `routeExternal` directly (fire-and-forget) after the outbox write — there is no runtime branch and no event emit.

### Vercel: Cron Sweep (Serverless)

On serverless (no persistent process), `notification-delivery` is a registered job (`jobs/index.ts`) scheduled in `vercel.json` at `/api/cron/notification-delivery` (dispatched through the generic `/api/cron/[job]` route). This cron is what drains pending Telegram / Discord / email deliveries on Vercel — the interval scheduler never runs there.

| Setting | Value |
|---------|-------|
| **Endpoint** | `/api/cron/notification-delivery` (via `/api/cron/[job]`) |
| **Cadence** | `0 8 * * *` (daily — Vercel Hobby rejects sub-daily crons at deploy time; restore `*/5 * * * *` on Pro) |
| **Purpose** | Process pending deliveries, retries |

> **Inngest is design-intent only.** It is not a dependency and is never imported. Async delivery uses the in-process worker (container) plus the cron sweep (serverless).

### Retry Configuration

Policy lives in `$lib/server/notifications/backoff.ts` (pure) with constants in `$lib/server/config.ts`. The delay is applied against the **database** clock, so a skewed app server cannot shift the queue.

| Setting | Value | Rationale |
|---------|-------|-----------|
| `DELIVERY_MAX_ATTEMPTS` | 5 | With real backoff, 3 covers only ~2.5 min of provider downtime |
| `DELIVERY_RETRY_BASE_MS` | 30s | Must exceed the 15s tick, or it is not a backoff |
| `DELIVERY_RETRY_FACTOR` | 4 | Curve: 30s → 2m → 8m → 32m (~42 min total window) |
| `DELIVERY_RETRY_MAX_MS` | 1 hour | Don't delay too long |
| `DELIVERY_RETRY_JITTER` | ±15% | Stop a recovered provider being hit by a herd |

Terminal states are split deliberately: **`failed`** means the provider says this will never work (403, bad address, no recipient) so a Retry button is pointless; **`dead`** means a retryable fault outlived the budget and a human should look. Only `dead` and `failed` rows are eligible for the admin retry action.

---

## Web Push Bypasses the Outbox

Push never writes a `notification_deliveries` row. `service.ts` partitions `'push'` out of the router's channel list **before** `createDeliveries` runs, then calls `sendPushNow()` directly: it renders a generic localized category line (`renderNotification('notif_push_{type}', {}, recipientLocale)`) and hands it to `WebPushProvider` fire-and-forget. No outbox row means no retry and no dead-letter state — a push send either reaches the browser's push service on the first attempt or it doesn't. See [../pwa.md](../pwa.md) for the full payload contract and subscription lifecycle.

---

## Quiet Hours and Digest

Both are decided at **enqueue** time in `routeExternal`, not at claim time. That is the load-bearing choice: putting either in the claim SQL would couple two user-preference features to the queue's hot path and to every test that exercises it. Deciding at enqueue also means push is covered by the same check, and push never touches the outbox at all.

### Quiet hours — drop, not defer

`quietStart` / `quietEnd` are nullable `HH:MM` text with **no** `quietHoursEnabled` flag, so **null = disabled** is the only convention available. The timezone lives on a different schema (`app.user_preferences.timezone`, IANA, default `'UTC'`); `routeExternal` reads that row once for both the locale push needs and the timezone quiet hours needs, so the feature costs no extra query.

`isQuietNow` (`quiet-hours.ts`) is pure and **fails closed** — anything unparseable disables quiet hours rather than silently swallowing notifications — and it handles the wrap-around window (`22:00 → 08:00`), which is the common configuration and the one a naive `start <= t && t <= end` gets wrong.

Inside the window, external channels are **dropped, not deferred**. The in-app notification and its live SSE frame have already been delivered, so the user still sees everything the moment they look; only the interrupting channels are suppressed. Deferring would have meant queueing against a cron that fires once daily on Hobby anyway.

### Digest — a second producer, the same outbox

`digestFrequency` has four values and all four are now real: `instant` (enqueue immediately), `never` (a permanent global mute, checked beside `mutedUntil`), and `daily` / `weekly`, which **suppress** the instant enqueue so the `notification-digest` job can build the deliveries instead.

- **Idempotency, not a lock.** `claimDigestRecipients` stamps `last_digest_at` in the same `UPDATE … FROM (SELECT … FOR UPDATE)` that selects due users, so a second cron fire in the same window matches zero rows. Same shape as `claimDeliveries`, and one statement for the same reason (`db.transaction()` takes the WebSocket path Bun mishandles).
- **The carrier row.** `notification_deliveries.notification_id` is `NOT NULL`, but a digest summarizes N notifications rather than being one. `createDigestCarrier` writes a **pre-archived** notification holding the subject (`notif_digest_subject` + `{count}`); `archived_at` is set so it never appears in the inbox or the unread count. The body rides on the new nullable `notification_deliveries.body_override`.
- **Per-channel bodies.** Telegram and Discord hard-cap message length — exceeding it is a *rejected* send, not a truncated one — so `renderDigest` takes a budget and the digest renders once per channel. Overflow is reported in the body (`… +N more`), never silently dropped.
- **Honest limit.** Hobby crons are daily-only, so `weekly` is a code-level gate (a 7-day window) inside the same daily job, and with ±59min jitter on both the digest job (`0 7`) and the delivery drain (`0 8`), a digest lands **0–24h** after generation.

**Security alerts bypass all of it** — quiet hours, digest suppression, and the global mute. Previously `mutedUntil` was checked *before* the security force-send, so a global mute suppressed security alerts while an explicit `emailSecurity: false` did not; the two mutes disagreed about the one category that matters most. Resolved in favour of always-deliver.

---

## Error Handling

### Error Classification

| Error Type | Retryable | Action |
|------------|-----------|--------|
| **Network timeout** | Yes | Retry with backoff |
| **Rate limited (429)** | Yes | Respect `Retry-After` |
| **Bot blocked (403)** | No | Mark channel inactive |
| **Invalid token (401)** | Maybe | Refresh token, then retry once |
| **User not found** | No | Mark channel inactive |
| **Malformed payload** | No | Log error, skip |

### Channel Deactivation

When a channel fails permanently:

1. Set `is_active = false` on the account row (`user_telegram_accounts` / `user_discord_accounts`)
2. Error detail is recorded per-delivery in `notification_deliveries.error_code` / `error_message` — the account row stores no error string
3. Send notification via other channels: "Your {channel} is disconnected"
4. Surface in settings UI with "Reconnect" button

---

## Delivery Tracking

### notification_deliveries Table

| Column | Purpose |
|--------|---------|
| `notification_id` | Parent notification |
| `channel` | email, telegram, discord (never `push` — see [Web Push Bypasses the Outbox](#web-push-bypasses-the-outbox)) |
| `status` | pending, processing, sent, failed, skipped, retrying, dead |
| `attempts` | Retry count |
| `provider_message_id` | External reference |
| `error_code` | Provider error code |
| `error_message` | Human-readable error |
| `attempted_at` | Last attempt timestamp |
| `sent_at` | Successful send timestamp |

### Retention Policy

> **Not implemented.** No job prunes `notification_deliveries` by status. The per-status table below is aspirational.

| Status | Retention |
|--------|-----------|
| `sent` | 7 days |
| `failed` | 30 days |
| `skipped` | 7 days |

The existing `jobs/notification-cleanup.ts` only touches the `notifications` table: it archives at `NOTIFICATION_ARCHIVE_DAYS` (30) and hard-deletes at `NOTIFICATION_DELETE_DAYS` (90).

---

## Module Structure

```
src/lib/server/notifications/
├── index.ts                # Re-exports public API
├── service.ts              # NotificationService.send() — single entry point (NotificationType inline union)
├── router.ts               # Preference resolution, channel selection
├── outbox.ts               # Delivery record management
├── stream.ts               # SSE: notifyUser() + connection registry (container only)
├── crypto.ts               # AES-GCM token encryption (ENCRYPTION_KEY)
├── health.ts               # Channel health stats
├── render-message.ts       # Notification → channel message body
├── telegram.ts             # Telegram link/verification helpers
└── providers/
    ├── index.ts            # Provider registry (getProvider by channel)
    ├── types.ts            # Provider interface
    ├── email.ts            # Resend provider
    ├── telegram.ts         # Raw fetch() to Bot API
    ├── discord.ts          # Discord REST provider
    └── web-push.ts         # WebPushProvider (VAPID, per-device fan-out)
```

DB read/write helpers live under `$lib/server/db/notifications/{queries,mutations,admin-queries}.ts`.

The delivery worker is `$lib/server/jobs/notification-delivery.ts`, driven by `$lib/server/jobs/delivery-scheduler.ts`. There is no Inngest function — Inngest is not wired.

### Runtime Detection

`service.ts` does not branch on runtime. After the outbox write it calls `routeExternal` directly (fire-and-forget). The persistent container's `delivery-scheduler.ts` worker (gated on `platform.persistent`) picks up pending records on its own interval; on serverless the `/api/cron/[job]` route sweeps them. No `inngest.send` call exists.

---

## Related

- [./channels.md](./channels.md) - Channel connection flows
- [./schema.md](./schema.md) - Database tables
- [../middleware.md](../middleware.md) - Hooks integration
- [../../stack/notifications/](../../stack/notifications/) - Provider details
- [../pwa.md](../pwa.md) - Web push design record (payload contract, subscription lifecycle, delivery-mode verdict)
