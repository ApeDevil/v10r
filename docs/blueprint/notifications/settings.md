# Notification Settings UI

Frontend architecture for channel connections and notification settings management.

> **Terminology:** Notification channel configuration is a **Setting** (affects functionality) per [../../foundation/user-data.md](../../foundation/user-data.md).

---

## Route Structure

```
/app/settings/notifications/
├── +page.svelte                  # Main: connections + preferences
├── +page.server.ts               # Load + form actions
├── telegram/
│   └── callback/
│       ├── +page.svelte          # "Connecting..." loading state
│       └── +page.server.ts       # Webhook already handles, this is fallback
└── discord/
    └── callback/
        ├── +page.svelte          # "Connecting..." loading state
        └── +page.server.ts       # Exchange code, store tokens, redirect
```

### Why `/app/settings/notifications`?

| Alternative | Rejected Because |
|-------------|------------------|
| `/app/notifications/preferences` | "Notifications" = inbox, "Settings" = configuration |
| `/app/account/notifications` | Account is profile/security, not integrations |

**User mental model:** "I go to Settings to configure how things work."

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
  supportedChannels: ['email', 'telegram', 'discord'],
  required: false
}

// Security type (cannot disable email)
{
  id: 'security',
  name: 'Security alerts',
  description: 'Password changes, new logins',
  supportedChannels: ['email', 'telegram', 'discord'],
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

### Form Schema

```
notification_settings:
  mention:
    email: boolean
    telegram: boolean
    discord: boolean
  comment:
    email: boolean
    telegram: boolean
    discord: boolean
  security:
    email: true  # Forced, cannot be false
    telegram: boolean
    discord: boolean
  system:
    email: boolean
    telegram: boolean
    discord: boolean
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

## Form Actions

| Action | Purpose |
|--------|---------|
| `connectTelegram` | Generate token, return deep link |
| `disconnectTelegram` | Set `is_active = false` |
| `disconnectDiscord` | Revoke token, set `is_active = false` |
| `updateSettings` | Save settings matrix |

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
├── ChannelCard.svelte          # Single channel connection card
├── PreferencesMatrix.svelte    # Type × Channel grid
├── PreferencesCard.svelte      # Mobile stacked version
├── ConnectionStatus.svelte     # Polling indicator
└── FrequencySelector.svelte    # Email digest options
```

---

## Related

- [./channels.md](./channels.md) - Backend connection flows
- [./routing.md](./routing.md) - How preferences affect delivery
- [../app-shell/settings.md](../app-shell/settings.md) - Settings page patterns
- [../forms.md](../forms.md) - Form handling patterns
