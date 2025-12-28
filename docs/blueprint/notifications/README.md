# Multi-Channel Notifications

Implementation strategy for extending the in-app notification system to external channels (Email, Telegram, Discord).

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
│   2. Load user preferences + connected channels                 │
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
| **[routing.md](./routing.md)** | • Notification router architecture<br>• Provider abstraction and rate limiting<br>• Outbox pattern with Inngest<br>• Delivery tracking and retry logic |
| **[channels.md](./channels.md)** | • Telegram deep link connection flow<br>• Discord OAuth2 flow and DM limitations<br>• Credential storage and token refresh<br>• Channel health monitoring |
| **[preferences.md](./preferences.md)** | • Route structure (`/app/settings/notifications`)<br>• Channel × Type matrix UI<br>• Connection management UX<br>• Mobile considerations |
| **[schema.md](./schema.md)** | • `user_telegram_accounts` table<br>• `user_discord_accounts` table<br>• Extended preferences columns<br>• Delivery tracking tables |

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
| **Routing approach** | Outbox + Inngest | Serverless-compatible, built-in retries |
| **Telegram SDK** | GramIO | Official Bun support (grammY works but via compatibility layer) |
| **Rate limiting** | Dynamic header parsing | Discord rate limits are not hard-coded, must parse response headers |
| **Token encryption** | AES-256-GCM + envelope | Industry standard; unique nonce per operation |
| **Channel tables** | Separate per channel | Type-safe columns, Discord needs extra token fields |

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
| **Background jobs** | Inngest for async delivery |
| **Auth** | [../auth.md](../auth.md) - Discord OAuth uses same patterns |
| **Rate limiting** | [../rate-limiting.md](../rate-limiting.md) - Per-provider limits |
| **Error handling** | [../error-handling.md](../error-handling.md) - Delivery failure patterns |

## Related Stack Docs

- [../../stack/notifications/README.md](../../stack/notifications/README.md) - Provider details
- [../../stack/notifications/telegram.md](../../stack/notifications/telegram.md) - Telegram specifics
- [../../stack/notifications/discord.md](../../stack/notifications/discord.md) - Discord specifics
- [../../stack/notifications/resend.md](../../stack/notifications/resend.md) - Email provider
