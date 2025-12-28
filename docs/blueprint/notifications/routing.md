# Notification Routing

Backend architecture for multi-channel notification delivery.

---

## Routing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NotificationService.send()                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: { userId, type, title, body, entityRef?, actionUrl? }               │
│                                                                              │
│  1. Create in-app notification record (always)                              │
│  2. Load user preferences + connected channels                               │
│  3. Apply routing rules:                                                     │
│     - Security type → force email (cannot disable)                          │
│     - Check preference matrix for each channel                              │
│     - Skip disconnected/inactive channels                                   │
│  4. Create delivery records in outbox                                       │
│  5. Trigger Inngest event: "notification/queued"                            │
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

### Telegram Provider (GramIO)

| Aspect | Detail |
|--------|--------|
| **SDK** | `gramio` (native Bun support) |
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

| Approach | Pros | Cons |
|----------|------|------|
| **Inngest built-in** | Zero config, per-step limits | Requires Inngest |
| **Database-backed** | No external deps | Adds DB queries |
| **Upstash Redis** | Fast, distributed | Another service |

**Recommendation:** Use Inngest's `rateLimit` option for provider steps. Falls back naturally to retry behavior.

---

## Outbox Pattern

Store pending deliveries in database before async processing:

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│  Sync       │────▶│ notification_       │────▶│  Inngest    │
│  Handler    │     │ deliveries (outbox) │     │  Worker     │
└─────────────┘     └─────────────────────┘     └─────────────┘
      │                       │                       │
      ▼                       ▼                       ▼
 In-app notif           Delivery          External providers
   created              persisted            called async
```

### Why Outbox?

| Benefit | Explanation |
|---------|-------------|
| **Transactional safety** | Delivery records created in same transaction as notification |
| **Retry from source** | Failed deliveries can be retried from database state |
| **Observability** | Full audit trail of what was sent where |
| **Decoupling** | Request handler doesn't wait for external APIs |

---

## Inngest Workflow

### Event: `notification/queued`

Triggered when notification is created with external deliveries.

| Step | Action |
|------|--------|
| 1 | Load delivery records for notification |
| 2 | Fan out to provider steps (parallel) |
| 3 | Each step: call provider, update delivery status |
| 4 | On failure: retry with backoff (max 3) |
| 5 | On permanent failure: mark inactive, alert |

### Retry Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| `retries` | 3 | Balance reliability vs spam |
| `backoff` | Exponential | Respect rate limits |
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
4. Surface in preferences UI with "Reconnect" button

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

Clean up via scheduled Inngest job (daily).

---

## Module Structure

```
src/lib/server/notifications/
├── service.ts              # NotificationService (main entry)
├── router.ts               # Preference resolution, channel selection
├── providers/
│   ├── index.ts            # Provider registry
│   ├── email.ts            # Resend provider
│   ├── telegram.ts         # GramIO provider
│   └── discord.ts          # Discord REST provider
├── outbox.ts               # Delivery record management
└── inngest/
    ├── client.ts           # Inngest client setup
    └── functions/
        └── deliver.ts      # notification/queued handler
```

---

## Related

- [./channels.md](./channels.md) - Channel connection flows
- [./schema.md](./schema.md) - Database tables
- [../middleware.md](../middleware.md) - Hooks integration
- [../../stack/notifications/](../../stack/notifications/) - Provider details
