# Telegram Notifications

## What is it?

Telegram Bot API integration for sending notifications directly to users' Telegram accounts. Users connect their Telegram via deep linking.

## What is it for?

- Real-time alerts (security, mentions)
- Mobile notifications without browser/PWA
- Users who prefer Telegram over email
- Time-sensitive notifications

## Why Telegram?

| Channel | Delivery Speed | User Reach | Setup Complexity |
|---------|---------------|------------|------------------|
| Email | Minutes | Universal | Low |
| **Telegram** | Instant | Telegram users | Medium |
| Discord | Instant | Discord users | High (OAuth2) |
| SMS | Instant | Universal | High (cost, regulations) |

**Telegram advantages:**
- Instant delivery, high open rates
- No OAuth2 needed (deep linking)
- Free (no per-message cost)
- Rich formatting (Markdown, buttons)

## Bot Setup

### 1. Create Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Choose name and username
4. Receive bot token → store as `TELEGRAM_BOT_TOKEN`

### 2. Choose SDK

| Framework | TypeScript | Bun Support | Recommendation |
|-----------|------------|-------------|----------------|
| **grammY** | Excellent | Yes | Best for most cases |
| **GramIO** | Excellent | Explicit | Alternative, auto-generated types |
| Telegraf | Good | Yes | Mature but complex types |

### 3. Webhook vs Polling

| Mode | Use case |
|------|----------|
| **Webhook** | Production (Telegram calls your endpoint) |
| **Polling** | Development (your bot polls Telegram) |

## User Connection Flow

| Step | Action |
|------|--------|
| 1 | Generate unique verification token (expires in 15 min) |
| 2 | Create deep link: `https://t.me/{bot}?start={token}` |
| 3 | User clicks link, opens Telegram, sends `/start` |
| 4 | Bot receives `/start {token}`, verifies token |
| 5 | Store mapping: `user_id` → `telegram_chat_id` |
| 6 | Confirm connection in both app and Telegram |

## Database Tables

| Table | Columns |
|-------|---------|
| `user_telegram_accounts` | user_id, telegram_chat_id, telegram_username, linked_at, is_active |
| `telegram_verification_tokens` | token, user_id, expires_at, used |

## Message Formatting

| Format | Syntax |
|--------|--------|
| Bold | `*bold*` |
| Italic | `_italic_` |
| Code | `` `code` `` |
| Link | `[text](url)` |

**Note:** MarkdownV2 requires escaping special characters: `_ * [ ] ( ) ~ > # + - = | { } . !`

### Inline Buttons

Messages can include clickable buttons:
- **URL buttons** - Open external links
- **Callback buttons** - Trigger bot actions

## Rate Limits

| Scope | Limit |
|-------|-------|
| Overall | 30 messages/second |
| Per chat | 1 message/second |
| Per group | 20 messages/minute |

**Best practices:**
- Queue messages for batch sending
- Implement exponential backoff on 429 errors
- Don't send identical messages to many users rapidly

## Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| User must initiate conversation | Can't message users who haven't started bot | Clear onboarding flow |
| No delivery receipts | Can't confirm message received | Accept best-effort delivery |
| Bot can be blocked | User blocks = silent failure | Handle gracefully, mark inactive |
| Chat ID changes (rare) | User deletes/recreates account | Re-verification flow |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Token brute-force | Short expiry (15 min), rate limit generation |
| Replay attacks | Mark tokens as used immediately |
| Bot token exposure | Store in env vars, never log |
| Chat ID spoofing | Validate via Telegram API, not user input |

## Related

- [README.md](./README.md) - Notification architecture
- [discord.md](./discord.md) - Discord integration (more complex)
- [../vendors.md](../vendors.md) - Provider comparison
