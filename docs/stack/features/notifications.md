# Notifications

## What is it?

Multi-channel notification system supporting email, push, in-app, and chat. Built on open-source platform with unified API and self-hosting option.

## What is it for?

- Transactional email (order confirmations, password resets)
- Push notifications (mobile/web alerts)
- In-app notification center
- Team notifications (Slack, Discord)
- SMS for critical alerts

## Why was it chosen?

| Platform | Channels | Self-Host | Cost |
|----------|----------|-----------|------|
| **Novu** | All | Yes (MIT) | Free tier |
| Knock | All | No | Paid |
| OneSignal | Push only | No | Free tier |
| Firebase FCM | Push only | No | Free |
| DIY | Custom | Yes | High maintenance |

**Novu advantages:**
- Open-source (MIT)—self-hostable
- Unified API for all channels
- SvelteKit integration
- Workflow-based orchestration
- Digest/batching support

**Channel providers:**
| Channel | Provider | Use Case |
|---------|----------|----------|
| Email | Resend | Transactional, marketing |
| Push | FCM | Mobile/web alerts |
| In-App | Novu Inbox | Notification center |
| SMS | Twilio | Critical alerts, 2FA |
| Chat | Webhooks | Slack, Discord |

## Known limitations

**Novu Cloud:**
- Free tier has limits
- Adds vendor dependency
- Latency for real-time

**Self-hosting:**
- Requires MongoDB + Redis
- Adds operational complexity
- Must maintain updates

**Push notifications:**
- VAPID keys required
- Service worker setup
- User must grant permission
- iOS Safari limitations

**Email deliverability:**
- Sender reputation matters
- Requires proper DNS (SPF, DKIM, DMARC)
- Bounce handling needed

**User preferences:**
- Must implement preference storage
- Check before every send
- Digest frequency options add complexity

## Related

- [api.md](./api.md) - Background jobs
- [gdpr.md](./gdpr.md) - Consent for marketing
- [../auth/better-auth.md](../auth/better-auth.md) - User identification
