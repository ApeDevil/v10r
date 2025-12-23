# Notifications

Multi-channel notification system: email, push, in-app, chat.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Platform | **Novu** | Open-source, multi-channel, self-hostable |
| Email Provider | **Resend** | Already in stack, simple API |
| Push Provider | **FCM** | Free, works on web and mobile |
| In-App | **Novu Inbox** | Built-in component, real-time |

## Why Novu

| Solution | Channels | Self-Host | Cost | Notes |
|----------|----------|-----------|------|-------|
| **Novu** | All | Yes (MIT) | Free tier | Best overall |
| Knock | All | No | Paid | Hosted only |
| OneSignal | Push only | No | Free tier | Push-focused |
| Firebase FCM | Push only | No | Free | Google ecosystem |
| DIY | Custom | Yes | Free | High maintenance |

Novu wins: open-source, self-hostable, unified API, SvelteKit integration.

## Channels

| Channel | Provider | Use Case |
|---------|----------|----------|
| **Email** | Resend, SendGrid, SES | Transactional, marketing |
| **Push** | FCM, APNS, OneSignal | Mobile/web alerts |
| **In-App** | Novu Inbox | Notification center |
| **SMS** | Twilio, Plivo | Critical alerts, 2FA |
| **Chat** | Slack, Discord | Team notifications |

## Setup

Install `@novu/node` and `@novu/framework`. Create client in `src/lib/server/novu.ts`.

Define workflows in `src/lib/novu/workflows.ts` using `workflow()`. Workflows define steps (email, push, in-app) with templates.

Create endpoint at `/api/novu` using `serve()` from `@novu/framework/sveltekit`.

## Triggering

Trigger from server actions or API routes: `novu.trigger(workflowName, { to, payload })`. Specify subscriber ID, email, payload data.

## In-App

### Novu Inbox

Pre-built component. Import `@novu/js`, create `Inbox` instance with subscriberId and applicationIdentifier, mount to container.

### Custom

Build with Svelte runes. Store notifications array, unread count (derived), functions for add/mark read. Bell icon with badge and dropdown.

## Push

### Web Push

Service worker, VAPID keys, push subscription. Subscribe via `pushManager.subscribe()`, send to server.

Service worker listens for push events, shows notification (title/body/icon), handles clicks to open URLs.

## Preferences

Store in database: userId, channel booleans (email, push, inApp, marketing), digest frequency (instant, daily, weekly).

Check before triggering. Only send if user opted in.

## Digests

Batch with `step.digest()`. Collect events over time window (24 hours), send single email.

## Toasts

Use `svelte-french-toast`. Add `<Toaster />` to layout, call `toast.success()`, `toast.error()`, `toast()` anywhere.

## Architecture

```
User Action (purchase, comment, etc.)
  → SvelteKit Server Action
    → Novu Trigger (workflow name + payload)
      → Novu Engine
        → Check user preferences
        → Route to channels:
          ├── Email → Resend
          ├── Push → FCM → Browser/Mobile
          ├── In-App → WebSocket → Inbox component
          └── SMS → Twilio (if critical)
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NOVU_API_KEY` | Novu API authentication |
| `VITE_NOVU_APP_ID` | Novu application identifier (client) |
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key (server) |

## Self-Hosting

Docker Compose with MongoDB and Redis. Add novu container to compose.yaml.

**Trade-off:** Adds complexity. Use Novu Cloud for simpler setup.

## Checklist

- [ ] Novu account or self-hosted instance
- [ ] Workflows defined for key events
- [ ] SvelteKit endpoint for Novu bridge
- [ ] Email provider connected (Resend)
- [ ] In-app notification component
- [ ] Push notifications (optional)
- [ ] User preference management
- [ ] Toast notifications for UI feedback
