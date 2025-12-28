# Novu (Notification Orchestration)

## What is it?

Open-source notification infrastructure platform. Provides unified API, workflow orchestration, preference management, and multi-channel delivery.

## What is it for?

- Unified API across all notification channels
- Workflow orchestration (delays, conditions, fan-out)
- Digest/batching (combine multiple notifications)
- Built-in preference management
- In-app notification center component

## When to Use Novu

| Scenario | Recommendation |
|----------|----------------|
| 3-4 channels, simple routing | **Custom routing** |
| Need digests ("daily summary") | Novu |
| Complex workflows (delay, retry, branch) | Novu |
| 5+ notification channels | Novu |
| Non-technical team needs to edit workflows | Novu |
| PostgreSQL-only requirement | **Custom routing** |

## Why We Default to Custom Routing

For Velociraptor, we start with custom routing because:

1. **Simpler stack** - No MongoDB + Redis requirement
2. **User linking is DIY anyway** - Novu doesn't handle Telegram/Discord OAuth
3. **3 channels** - Email, Telegram, Discord is manageable
4. **No complex workflows yet** - Direct send, no digests needed

**Migrate to Novu when:**
- We add SMS, WhatsApp, Slack, or Push
- Users request digest/summary emails
- Workflows need delays or conditions

## Novu Cloud vs Self-Hosted

| Aspect | Cloud | Self-Hosted |
|--------|-------|-------------|
| Setup | Instant | Docker Compose |
| Cost | Free: 30K events/mo | Free (MIT license) |
| Dependencies | None | MongoDB + Redis |
| Maintenance | Managed | You |
| EU hosting | Yes | Your infrastructure |

## What Novu Provides

| Feature | Details |
|---------|---------|
| Multi-channel routing | Email, SMS, Push, Chat, In-App |
| Workflow orchestration | Delay, digest, conditions |
| Preference management | Per-channel, per-workflow |
| In-app inbox | React/Vue/Web component |
| Analytics | Delivery rates, open rates |
| Template management | Visual editor |

## What You Still Build

| Feature | Details |
|---------|---------|
| Telegram user linking | Deep link flow, store chat_id |
| Discord OAuth | Token exchange, store credentials |
| Channel connection UI | Settings page in your app |
| Credential sync | Push to Novu when user links |

## Self-Hosting Requirements

| Component | Min RAM | Min CPU |
|-----------|---------|---------|
| API | 512 MB | 0.5 |
| Worker | 512 MB | 0.5 |
| Web Dashboard | 256 MB | 0.25 |
| MongoDB | 1 GB | 1 |
| Redis | 256 MB | 0.25 |

**Total:** ~2.5 GB RAM minimum

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Subscriber** | Your user, identified by subscriberId |
| **Workflow** | Notification template with channel steps |
| **Trigger** | Event that starts a workflow |
| **Step** | Single channel action (email, chat, etc.) |
| **Digest** | Batches multiple triggers into one notification |

## Provider Configuration

| Channel | Setup |
|---------|-------|
| Email | Configure Resend credentials in Novu |
| Telegram | Set bot token, update subscriber chat_id |
| Discord | Use webhook or custom step for DMs |

**Note:** For Discord DMs, Novu's built-in Discord provider uses webhooks (channel-only). Custom integration needed for user DMs.

## Alternatives

| Platform | Open Source | Self-Host | Differentiator |
|----------|-------------|-----------|----------------|
| **Novu** | Yes (MIT) | Yes | Best OSS option |
| Knock | No | No | Enterprise features |
| Courier | No | No | Visual designer |
| SuprSend | No | No | Analytics focus |
| Trigger.dev | Yes | Yes | Background jobs focus |

## Migration Path

### From Custom to Novu

1. Install Novu SDK
2. Create subscribers for existing users
3. Push existing channel credentials
4. Create workflow matching your notification types
5. Replace direct sends with Novu triggers
6. Migrate settings or use Novu's built-in

### From Novu to Custom

1. Export subscriber data
2. Implement direct channel sending
3. Migrate settings data to your tables
4. Replace Novu triggers with direct sends
5. Remove Novu dependencies

## Known Limitations

| Limitation | Impact |
|------------|--------|
| MongoDB + Redis required | Infrastructure overhead |
| Learning curve | Workflow concepts |
| Overkill for simple cases | Unnecessary complexity |
| Self-host maintenance | Updates, backups |

## Related

- [README.md](./README.md) - Custom routing architecture
- [telegram.md](./telegram.md) - Telegram integration
- [discord.md](./discord.md) - Discord integration
- [../vendors.md](../vendors.md) - Provider pricing
