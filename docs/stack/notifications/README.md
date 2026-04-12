# Notifications

Multi-channel notification system with user-controlled routing. Users connect their preferred channels and choose which notifications go where.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Notification Router                          │
│          (checks user settings, routes to channels)             │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│    Email     │   Telegram   │   Discord    │    In-App         │
│   (Resend)   │    (Bot)     │  (Bot+OAuth) │   (Database)      │
│   Primary    │   Optional   │   Optional   │   Always On       │
└──────────────┴──────────────┴──────────────┴───────────────────┘
```

## Contents

| File | Topics |
|------|--------|
| **[resend.md](./resend.md)** | Email provider, templates, deliverability, DNS setup |
| **[telegram.md](./telegram.md)** | Bot setup, deep linking, user connection flow |
| **[discord.md](./discord.md)** | Bot setup, OAuth2 flow, DM notifications |

## User Settings Model

Users control notifications through a **Channel × Type Matrix** (notification channels are **Settings** per [../../foundation/user-data.md](../../foundation/user-data.md)):

|                | Email | Telegram | Discord |
|----------------|:-----:|:--------:|:-------:|
| **Security**   |  ✓*   |    ✓     |    -    |
| **Social**     |   ✓   |    -     |    ✓    |
| **Marketing**  |   ✓   |    -     |    -    |
| **Updates**    |   ✓   |    ✓     |    ✓    |

*\*Required - cannot be disabled*

### Notification Types

| Type | Examples | Default Channels |
|------|----------|------------------|
| **Security** | Password reset, 2FA, suspicious login | Email (required) |
| **Social** | Mentions, follows, comments | Email |
| **Marketing** | Newsletter, promotions | Email (opt-in) |
| **Updates** | Feature announcements, system status | Email |

## Channel Connection Flow

| Channel | Method | Complexity |
|---------|--------|------------|
| **Email** | Always connected via account | None |
| **Telegram** | Deep link (`t.me/Bot?start=token`) | Low |
| **Discord** | OAuth2 authorization | Medium |

### Telegram Flow
1. User clicks "Connect Telegram" → generates verification token
2. Opens Telegram deep link → user sends `/start` to bot
3. Bot verifies token → links `chat_id` to user account

### Discord Flow
1. User clicks "Connect Discord" → OAuth2 redirect
2. User approves access → app receives tokens
3. Store `discord_user_id` → bot can now send DMs

## Database Tables

| Table | Purpose |
|-------|---------|
| `user_telegram_accounts` | Telegram chat_id per user |
| `user_discord_accounts` | Discord user_id + OAuth tokens |
| `notification_settings` | Per-type channel toggles |

## Design Decisions

### Why Custom Routing?

| Factor | Rationale |
|--------|-----------|
| Database | PostgreSQL only (no MongoDB/Redis) |
| User linking | Telegram/Discord linking is DIY regardless |
| Complexity | Simpler for 3-4 channels |
| Stack alignment | Matches our serverless-first approach |

**Decision**: Custom routing with Inngest for async delivery. See [../../blueprint/notifications/](../../blueprint/notifications/) for implementation.

### Why Email is Primary?

- **Universal** - Everyone has email
- **Reliable** - No app required, works offline
- **Required for security** - Password resets, 2FA
- **Legal compliance** - GDPR requires communication channel

### Why Not SMS?

- High cost ($0.0075+ per message)
- User friction (phone number required)
- Regional complexity
- Reserved for critical alerts only (2FA fallback)

## Related

- [../vendors.md](../vendors.md) - Provider pricing and alternatives
- [../capabilities/gdpr.md](../capabilities/gdpr.md) - Consent for marketing notifications
- [../auth/better-auth.md](../auth/better-auth.md) - User identification
- [../capabilities/pwa.md](../capabilities/pwa.md) - Push notifications (browser-based)
