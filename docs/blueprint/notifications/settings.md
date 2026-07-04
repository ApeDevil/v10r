# Notification Settings UI

Frontend architecture for channel connections and notification settings management.

> **Terminology:** Notification channel configuration is a **Setting** (affects functionality) per [../../foundation/user-data.md](../../foundation/user-data.md).

---

## Route Structure

```
/app/notifications/settings/
├── +page.svelte                  # Main: connections + preferences
├── +page.server.ts               # Load + default action (save preferences)
└── discord/
    └── callback/
        ├── +page.svelte          # "Connecting..." loading state
        └── +page.server.ts       # Exchange code, store tokens, redirect
```

There is no `telegram/callback` route — Telegram links via the bot webhook plus polling of `/api/notifications/telegram/status`.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Notification Settings                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Connected Channels                                          │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐│ │
│ │ │ ✉️  Email                          Connected             ││ │
│ │ │ user@example.com                                        ││ │
│ │ │                                    (Cannot disconnect)  ││ │
│ │ └─────────────────────────────────────────────────────────┘│ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐│ │
│ │ │ 📱 Telegram                        [Connect]             ││ │
│ │ │ Not connected                                           ││ │
│ │ └─────────────────────────────────────────────────────────┘│ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐│ │
│ │ │ 💬 Discord                         [Connect]             ││ │
│ │ │ Not connected                                           ││ │
│ │ │ ⚠️ Requires joining our server for DMs                  ││ │
│ │ └─────────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Notification Settings                                       │ │
│ │                                                             │ │
│ │                     Email   Telegram   Discord              │ │
│ │                                                             │ │
│ │ Mentions             ✓        ○          ○                 │ │
│ │ Comments             ✓        ○          ○                 │ │
│ │ Security alerts      ✓*       ○          ○                 │ │
│ │ System updates       ✓        ○          ○                 │ │
│ │                                                             │ │
│ │ * Required - cannot be disabled                            │ │
│ │ ○ Connect channel to enable                                │ │
│ │                                                             │ │
│ │ [Save Settings]                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Push (this device)                              [Enable]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Email Frequency                                             │ │
│ │                                                             │ │
│ │ ○ Real-time                                                 │ │
│ │ ● Daily digest                                              │ │
│ │ ○ Weekly digest                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Channel Connection Cards

### Connected State

```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 Telegram                                    ✓ Connected      │
│ @username                                                       │
│ Last notification: 2 hours ago                                  │
│                                                                  │
│                                               [Disconnect]      │
└─────────────────────────────────────────────────────────────────┘
```

### Disconnected State

```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 Telegram                                                      │
│ Not connected                                                    │
│                                                                  │
│ Connect to receive instant notifications on Telegram.           │
│                                                     [Connect]   │
└─────────────────────────────────────────────────────────────────┘
```

### Error State

```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 Telegram                                    ⚠️ Disconnected   │
│ @username                                                       │
│                                                                  │
│ Bot was blocked. Reconnect to resume notifications.             │
│                                               [Reconnect]       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Settings Matrix

### Data Structure

```typescript
// NotificationType config (static)
{
  id: 'mention',
  name: 'Mentions',
  description: 'When someone @mentions you',
  supportedChannels: ['email', 'telegram', 'discord', 'push'],
  required: false
}

// Security type (cannot disable email)
{
  id: 'security',
  name: 'Security alerts',
  description: 'New device logins, security events',
  supportedChannels: ['email', 'telegram', 'discord', 'push'],
  required: true,  // Cannot disable email
  requiredChannels: ['email']
}
```

### Matrix Cell States

| State | Visual | Interaction |
|-------|--------|-------------|
| **Enabled** | ✓ (checked) | Click to disable |
| **Disabled** | ☐ (unchecked) | Click to enable |
| **Unavailable** | ○ (greyed out) | Click shows "Connect {channel}" tooltip |
| **Required** | ✓* (locked) | Cannot click, shows "Required" tooltip |
| **Not supported** | — (dash) | Channel doesn't support this type |

### Notification Types

There are 6 notification types: `mention`, `comment`, `system`, `success`, `security`, `follow`. Email has a per-type toggle for all 6. Telegram, Discord, and Push only have toggles for `mention`, `comment`, `system`, `security` (no `success`/`follow` columns), per `notification-settings.ts`.

### Form Schema

```
notification_settings:
  # Email: all 6 types
  email:    mention, comment, system, success, security, follow
  # Telegram / Discord / Push: 4 types only
  telegram: mention, comment, system, security
  discord:  mention, comment, system, security
  push:     mention, comment, system, security
  # security email is forced true (cannot be disabled)
```

---

## Connection Flows

### Telegram Connection

1. User clicks "Connect Telegram"
2. Form action generates verification token
3. Returns deep link URL
4. Client opens `t.me/Bot?start=TOKEN` in new tab
5. User sends `/start` to bot in Telegram
6. Bot webhook validates token, links account
7. User returns to settings page
8. Page shows polling indicator, then updates to "Connected"

**Polling after click:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 Telegram                                                      │
│ Waiting for Telegram...                              [Cancel]   │
│ Open Telegram and send /start to @YourBot                       │
└─────────────────────────────────────────────────────────────────┘
```

Poll `/api/notifications/telegram/status` every 3 seconds until connected or cancelled.

### Discord Connection

1. User clicks "Connect Discord"
2. Navigate to Discord OAuth URL (same window on mobile, new tab on desktop)
3. User approves on Discord
4. Discord redirects to `/discord/callback`
5. Callback exchanges code, stores tokens, redirects to settings with success param
6. Settings page shows toast: "Discord connected!"

---

## Push Card (Per-Device)

Push doesn't fit the Channel × Type matrix above — it isn't one account-wide toggle, it's a subscription tied to *this browser on this device*. So it renders as its own card, sourced from browser state (permission + subscription), not from the page's server load:

| State | Card shows |
|-------|------------|
| Subscribed | 4 switches (mention/comment/system/security) + "Disable on this device" |
| Not subscribed | "Enable push" button (must be a user gesture — browsers reject permission requests from page load) |
| Permission denied | Recovery hint: how to re-enable notifications in browser settings |
| iOS, not installed | Install guidance — iOS only exposes `PushManager` inside the installed home-screen app, never in Safari tabs |

See [../pwa.md](../pwa.md) for the subscribe/unsubscribe flow and payload contract.

---

## Form Actions

The page server defines a single `default` action that saves the settings matrix. Connect and disconnect are not page form actions — they go through the `/api/notifications/*` endpoints.

| Action | Purpose |
|--------|---------|
| `default` | Save settings matrix |

**Connection endpoints (not form actions):**
- Telegram connect: `POST /api/notifications/telegram/connect`
- Discord connect: `GET /api/notifications/discord/authorize` (redirect)

---

## Mobile Considerations

### Touch Targets

| Element | Min Size |
|---------|----------|
| Checkboxes | 44×44px (WCAG, Apple HIG) |
| Buttons | 44×44px min height |
| Card tap areas | Full card width |

### Responsive Matrix

On mobile (<768px), matrix transforms to stacked cards:

```
┌─────────────────────────────────────────┐
│ Mentions                                │
│                                         │
│ Email      [✓]                          │
│ Telegram   [○] Connect to enable        │
│ Discord    [○] Connect to enable        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Security alerts                         │
│                                         │
│ Email      [✓] Required                 │
│ Telegram   [○] Connect to enable        │
│ Discord    [○] Connect to enable        │
└─────────────────────────────────────────┘
```

### OAuth on Mobile

Use `window.location.href` instead of `window.open()` for Discord OAuth:
- Mobile browsers may block popups
- Returning to app is more reliable with same-window navigation

---

## Accessibility

### ARIA Labels

| Element | Label |
|---------|-------|
| Channel card | "Telegram: Connected as @username" |
| Matrix checkbox | "Send mentions via Telegram" |
| Required checkbox | "Security alerts via Email (required)" |
| Disabled checkbox | "Connect Telegram to enable" |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between cards and controls |
| Space/Enter | Toggle checkbox, activate button |
| Escape | Close confirmation dialogs |

### Screen Reader Announcements

- After successful connection: "Telegram connected successfully"
- After settings save: "Notification settings saved"
- After disconnect: "Telegram disconnected"

---

## Data Loading

### Load Function

| Data | Source |
|------|--------|
| `channels` | Query all channel tables for user |
| `settings` | Query `notification_settings` row |
| `notificationTypes` | Static config (could be cached) |
| `discordClientId` | Environment variable |
| `discordRedirectUri` | Environment variable |

### Optimistic Updates

- Preference toggles: Update UI immediately, revert on error
- Connection status: Poll or use SSE for real-time updates
- Disconnect: Confirm first, then update

---

## Error Handling

| Error | Display |
|-------|---------|
| Token generation failed | Toast: "Failed to generate connection link" |
| OAuth cancelled | URL param → Toast: "Discord connection cancelled" |
| OAuth error | URL param → Toast: "Discord connection failed" |
| Settings save failed | Toast: "Failed to save settings" + revert |
| Channel already linked | Toast: "This Telegram account is already linked" |

---

## Component Structure

```
src/lib/components/composites/notifications/
├── NotificationBadge.svelte    # Unread count badge
├── NotificationCard.svelte     # Single notification row
├── NotificationCenter.svelte   # Inbox panel
├── NotificationFilters.svelte  # Filter controls
├── NotificationPreview.svelte  # Preview/render
└── index.ts                    # Re-exports
```

---

## Related

- [./channels.md](./channels.md) - Backend connection flows
- [./routing.md](./routing.md) - How preferences affect delivery
- [../app-shell/settings.md](../app-shell/settings.md) - Settings page patterns
- [../forms.md](../forms.md) - Form handling patterns
- [../pwa.md](../pwa.md) - Push subscribe/unsubscribe flow, payload contract
