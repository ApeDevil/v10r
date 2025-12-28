# Discord Notifications

## What is it?

Discord Bot integration for sending DM notifications to users. Requires OAuth2 for user linking (more complex than Telegram).

## What is it for?

- Real-time alerts for Discord-active users
- Gaming/community-focused applications
- Social notifications (mentions, activity)
- Team notifications (via webhooks to channels)

## Critical: Webhooks Cannot DM

| Approach | Use Case | Can DM Users? |
|----------|----------|---------------|
| **Bot + OAuth2** | User-specific notifications | Yes |
| **Webhooks** | Channel announcements | No |
| **Bot in Guild** | Server-wide notifications | Only shared server members |

**For user-specific notifications, you need a Bot + OAuth2.**

## Architecture

```
User clicks "Connect Discord"
         │
         ▼
    OAuth2 Flow ─────────────────┐
         │                       │
         ▼                       ▼
   Get access_token       Get discord_user_id
         │                       │
         └───────┬───────────────┘
                 ▼
           Store in DB
                 │
                 ▼
       Bot sends DM to user
```

## Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application
3. Go to "Bot" → Create Bot → get `DISCORD_BOT_TOKEN`
4. Go to "OAuth2" → Add redirect URI

### 2. Environment Variables

| Variable | Purpose |
|----------|---------|
| `DISCORD_CLIENT_ID` | OAuth2 client ID |
| `DISCORD_CLIENT_SECRET` | OAuth2 secret |
| `DISCORD_BOT_TOKEN` | Bot authentication |
| `DISCORD_REDIRECT_URI` | OAuth2 callback URL |

### 3. Required OAuth2 Scopes

| Scope | Purpose |
|-------|---------|
| `identify` | Get user ID and username |

**Note:** You do NOT need `dm` scope. The bot can DM any user who has authorized your OAuth2 app.

## User Connection Flow

| Step | Action |
|------|--------|
| 1 | Generate CSRF state token, store in cookie |
| 2 | Redirect to Discord authorization URL |
| 3 | User approves, Discord redirects back with code |
| 4 | Exchange code for access_token + refresh_token |
| 5 | Fetch user info (`/users/@me`) |
| 6 | Store discord_user_id + tokens in database |

## Database Tables

| Table | Columns |
|-------|---------|
| `user_discord_accounts` | user_id, discord_user_id, discord_username, access_token, refresh_token, token_expires_at, linked_at, is_active |

## Token Management

| Token | Lifetime | Action |
|-------|----------|--------|
| Access token | ~7 days | Use for API calls |
| Refresh token | ~30 days | Exchange for new access token |

**Important:** Implement token refresh before expiry. If refresh fails, mark connection as inactive.

## Sending DMs

| Step | API Call |
|------|----------|
| 1 | Create DM channel: `POST /users/@me/channels` with `recipient_id` |
| 2 | Send message: `POST /channels/{channel_id}/messages` |

## Message Formatting

Discord supports rich embeds:

| Element | Purpose |
|---------|---------|
| Title | Main heading |
| Description | Body text |
| Color | Sidebar color (hex) |
| URL | Clickable title |
| Timestamp | ISO 8601 format |
| Components | Action buttons |

### Button Types

| Style | Behavior |
|-------|----------|
| Link (5) | Opens URL in browser |
| Primary/Secondary | Triggers interaction (requires bot handler) |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Global | 50 requests/second |
| Per channel | 5 messages/5 seconds |
| DM creation | 10/second |

Discord returns `429 Too Many Requests` with `Retry-After` header.

## Webhooks (Channel Notifications)

For announcements to a channel (not user-specific):

| Feature | Details |
|---------|---------|
| Setup | Create webhook in Discord channel settings |
| Auth | Webhook URL contains token (no OAuth needed) |
| Use case | Team announcements, status updates |
| Limitation | Cannot send DMs |

## Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| User must authorize OAuth | Can't DM arbitrary users | Clear connection flow |
| DMs can be disabled | Message fails silently | Mark inactive on failure |
| Token expires | Must refresh periodically | Background refresh job |
| No delivery confirmation | Can't verify receipt | Best-effort delivery |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Token theft | Encrypt at rest, secure transport |
| OAuth state bypass | Validate state parameter (CSRF) |
| Refresh token exposure | Store securely, rotate on use |
| Rate limit abuse | Per-user rate limiting |

## Comparison with Telegram

| Factor | Discord | Telegram |
|--------|---------|----------|
| User linking | OAuth2 (complex) | Deep link (simple) |
| Token management | Access + refresh tokens | None (chat_id only) |
| Setup complexity | Higher | Lower |
| Message formatting | Rich embeds | Markdown |
| Rate limits | Stricter | More lenient |

**Recommendation:** Prioritize Telegram for simpler integration. Discord is better for gaming/community apps where users are already engaged.

## Related

- [README.md](./README.md) - Notification architecture
- [telegram.md](./telegram.md) - Telegram integration (simpler)
- [../auth/better-auth.md](../auth/better-auth.md) - OAuth patterns
