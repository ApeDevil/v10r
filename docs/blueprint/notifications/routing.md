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
| **Processing** | SELECT pending deliveries, process in batches |
| **Retry** | Built into worker loop — failed records stay pending, attempts incremented |
| **Advantage** | Zero external dependencies, immediate pickup, full control |

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

| Setting | Value | Rationale |
|---------|-------|-----------|
| `maxAttempts` | 3 | Balance reliability vs spam |
| `backoff` | Exponential (1s, 4s, 16s) | Respect rate limits |
| `maxDelay` | 1 hour | Don't delay too long |

---

## Web Push Bypasses the Outbox

Push never writes a `notification_deliveries` row. `service.ts` partitions `'push'` out of the router's channel list **before** `createDeliveries` runs, then calls `sendPushNow()` directly: it renders a generic localized category line (`renderNotification('notif_push_{type}', {}, recipientLocale)`) and hands it to `WebPushProvider` fire-and-forget. No outbox row means no retry and no dead-letter state — a push send either reaches the browser's push service on the first attempt or it doesn't. See [../pwa.md](../pwa.md) for the full payload contract and subscription lifecycle.

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
