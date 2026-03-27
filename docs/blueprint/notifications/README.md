# Multi-Channel Notifications

Implementation strategy for extending the in-app notification system to external channels (Email, Telegram, Discord).

## Design Principle: Container-First, Serverless-Compatible

The notification system is designed for a **persistent Bun container** as the primary runtime, with Vercel serverless as a compatible deployment target. This matters because persistent runtimes unlock better real-time delivery (SSE, in-memory connection maps, background workers) that serverless constrains.

| Capability | Container (Primary) | Vercel Serverless |
|---|---|---|
| Real-time delivery | SSE + in-memory map | Polling + `invalidate()` |
| Outbox processing | `setInterval` worker | Inngest or Vercel cron |
| PG `LISTEN`/`NOTIFY` | Works (direct connection) | Blocked (pooled HTTP) |
| Background workers | Native, persistent | Need external service |

The architecture adapts automatically based on the runtime — the same codebase works in both environments.

## Overview

Users connect their preferred channels and control which notification types go where via a Channel × Type preference matrix.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Notification Trigger                          │
│         (form action, API, system event)                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Notification Router                           │
│   1. Create in-app notification (always)                        │
│   2. Load user settings + connected channels                    │
│   3. Queue external deliveries via outbox                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
    ┌─────────┐          ┌──────────┐         ┌──────────┐
    │  Email  │          │ Telegram │         │ Discord  │
    │(Resend) │          │  (Bot)   │         │(Bot+OAuth)│
    │ Primary │          │ Optional │         │ Optional │
    └─────────┘          └──────────┘         └──────────┘
```

## Contents

| File | Topics |
|------|--------|
| **[routing.md](./routing.md)** | • Notification router architecture<br>• Provider abstraction and rate limiting<br>• Outbox pattern with runtime-adaptive processing<br>• Delivery tracking and retry logic |
| **[channels.md](./channels.md)** | • Telegram deep link connection flow<br>• Discord OAuth2 flow and DM limitations<br>• Credential storage and token refresh<br>• Channel health monitoring |
| **[settings.md](./settings.md)** | • Route structure (`/app/settings/notifications`)<br>• Channel × Type settings matrix UI<br>• Connection management UX<br>• Mobile considerations |
| **[schema.md](./schema.md)** | • `user_telegram_accounts` table<br>• `user_discord_accounts` table<br>• Extended settings columns<br>• Delivery tracking tables |

## Critical Decision: Discord DM Limitation

**Discord currently has no OAuth2 scope for sending DMs to users without a mutual server.**

| Option | Complexity | User Experience |
|--------|------------|-----------------|
| **Require mutual server** | Low | User must join app's Discord server |
| **Skip Discord DMs** | Lowest | Discord only for webhooks/channels |
| **Wait for Discord feature** | N/A | Feature request exists, timeline unknown |

**Recommendation:** Start with Telegram + Email. Add Discord only for webhook-based channel notifications, not user DMs.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Routing approach** | Outbox + runtime-adaptive worker | Container: direct `setInterval` worker. Vercel: Inngest or cron. Same outbox table either way. |
| **Telegram delivery** | Raw `fetch()` to Bot API | Zero dependencies for outbound-only notifications. Add grammY only if bidirectional bot commands needed. |
| **Rate limiting** | Dynamic header parsing | Discord rate limits are not hard-coded, must parse response headers |
| **Token encryption** | AES-256-GCM + envelope | Industry standard; unique nonce per operation |
| **Channel tables** | Separate per channel | Type-safe columns, Discord needs extra token fields |
| **Real-time (in-app)** | SSE on container, polling on serverless | Container has persistent process for in-memory connection map. Serverless lacks this. |
| **Unread count cache** | Direct DB query (defer Redis) | Properly indexed `WHERE is_read = false` is fast enough for MVP. Add Upstash Redis only when measured as bottleneck. |

## Build vs Buy: Novu Consideration

Industry research suggests notification platforms like Novu are recommended for 3+ channels. However:

| Factor | Custom Routing | Novu |
|--------|---------------|------|
| **Stack complexity** | PostgreSQL only | +MongoDB +Redis |
| **Time to implement** | 2-4 weeks | 1 week setup |
| **Maintenance** | Ongoing | Managed (if cloud) |
| **User linking** | Build ourselves | Build ourselves |
| **Digests/batching** | Build ourselves | Built-in |

**Our decision:** Start with custom routing because:
1. No MongoDB/Redis requirement aligns with stack philosophy
2. User linking (Telegram deep link, Discord OAuth) is DIY regardless
3. 3 channels is on the threshold - reassess if adding SMS/WhatsApp/Slack

**Migrate to Novu when:** Adding 4th channel, needing digests, or complex workflows (delays, conditions).

## Integration Points

| Component | Integration |
|-----------|------------|
| **In-app notifications** | [../app-shell/notifications.md](../app-shell/notifications.md) - Extends existing system |
| **Background jobs** | Container: existing job runner (`setInterval`). Vercel: Inngest or cron. See [routing.md](./routing.md). |
| **Auth** | [../auth.md](../auth.md) - Discord OAuth uses same patterns |
| **Rate limiting** | [../rate-limiting.md](../rate-limiting.md) - Per-provider limits |
| **Error handling** | [../error-handling.md](../error-handling.md) - Delivery failure patterns |

## Related Stack Docs

- [../../stack/notifications/README.md](../../stack/notifications/README.md) - Provider details
- [../../stack/notifications/telegram.md](../../stack/notifications/telegram.md) - Telegram specifics
- [../../stack/notifications/discord.md](../../stack/notifications/discord.md) - Discord specifics
- [../../stack/notifications/resend.md](../../stack/notifications/resend.md) - Email provider
