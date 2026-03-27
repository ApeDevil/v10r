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
│  5. Trigger delivery:                                                        │
│     - Container: notify in-process worker (immediate pickup)                │
│     - Vercel: emit Inngest event "notification/queued"                      │
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
│  Sync       │────▶│ notification_       │────▶│  Inngest /       │
│  Handler    │     │ deliveries (outbox) │     │  Vercel Cron     │
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

The existing job runner at `src/lib/server/jobs/scheduler.ts` already supports `setInterval`-based background jobs. Add a `notification-delivery` job:

| Aspect | Detail |
|--------|--------|
| **Trigger** | `setInterval` (every 10-30 seconds, configurable) |
| **Processing** | SELECT pending deliveries, process in batches of 50 |
| **Retry** | Built into worker loop — failed records stay pending, attempts incremented |
| **Advantage** | Zero external dependencies, immediate pickup, full control |

### Vercel: Inngest (Fallback)

When deployed on serverless, Inngest provides step-level durability:

| Aspect | Detail |
|--------|--------|
| **Trigger** | `inngest.send({ name: 'notification/queued' })` after outbox write |
| **Processing** | Each channel is a separate step (parallel fan-out) |
| **Retry** | Per-step retry with exponential backoff (max 3) |
| **Advantage** | Survives function timeouts, per-step retry prevents double-sends |
| **Free tier** | 50K executions/month |

### Vercel: Cron Sweep (Safety Net)

Regardless of runtime, a periodic cron job sweeps for any outbox records stuck in `pending` state (belt-and-suspenders):

| Setting | Value |
|---------|-------|
| **Schedule** | Every 60 seconds |
| **Endpoint** | `/api/cron/notification-delivery` |
| **Purpose** | Catch leaked records, process retries |

### Retry Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| `maxAttempts` | 3 | Balance reliability vs spam |
| `backoff` | Exponential (1s, 4s, 16s) | Respect rate limits |
| `maxDelay` | 1 hour | Don't delay too long |

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

1. Set `is_active = false` in channel table
2. Store error message in `last_error` column
3. Send notification via other channels: "Your {channel} is disconnected"
4. Surface in settings UI with "Reconnect" button

---

## Delivery Tracking

### notification_deliveries Table

| Column | Purpose |
|--------|---------|
| `notification_id` | Parent notification |
| `channel` | email, telegram, discord |
| `status` | pending, processing, sent, failed, skipped |
| `attempts` | Retry count |
| `provider_message_id` | External reference |
| `error_code` | Provider error code |
| `error_message` | Human-readable error |
| `attempted_at` | Last attempt timestamp |
| `sent_at` | Successful send timestamp |

### Retention Policy

| Status | Retention |
|--------|-----------|
| `sent` | 7 days |
| `failed` | 30 days |
| `skipped` | 7 days |

Clean up via scheduled job (daily) — runs as `setInterval` in container, Vercel cron on serverless.

---

## Module Structure

```
src/lib/server/notifications/
├── index.ts                # Re-exports public API
├── service.ts              # NotificationService.send() — single entry point
├── router.ts               # Preference resolution, channel selection
├── queries.ts              # DB queries (getUnread, markRead, etc.)
├── types.ts                # NotificationType, DeliveryResult, etc.
├── stream.ts               # SSE: notifyUser() + connection registry (container only)
├── providers/
│   ├── index.ts            # Provider registry (getProvider by channel)
│   ├── types.ts            # Provider interface
│   ├── email.ts            # Resend provider
│   ├── telegram.ts         # Raw fetch() to Bot API
│   └── discord.ts          # Discord REST provider
├── outbox.ts               # Delivery record management
└── inngest/                # Only used on Vercel deployments
    ├── client.ts           # Inngest client setup
    └── functions/
        └── deliver.ts      # notification/queued handler
```

### Runtime Detection

```typescript
// Use the same pattern as existing job scheduler
const IS_SERVERLESS = !!process.env.VERCEL;

// In service.ts, after outbox write:
if (IS_SERVERLESS && inngest) {
  await inngest.send({ name: 'notification/queued', data: { notificationId } });
}
// On container, the in-process worker picks up pending records automatically
```

---

## Related

- [./channels.md](./channels.md) - Channel connection flows
- [./schema.md](./schema.md) - Database tables
- [../middleware.md](../middleware.md) - Hooks integration
- [../../stack/notifications/](../../stack/notifications/) - Provider details
