# Channel Connections

How users connect external notification channels (Telegram, Discord) to their account.

---

## Email Channel

Email is always connected via the user's account email. No connection flow needed.

| Aspect | Detail |
|--------|--------|
| **Connection** | Automatic (uses account email) |
| **Preferences** | Only per-type toggles |
| **Disconnection** | Cannot disconnect (but can disable per-type) |

---

## Telegram Channel

### Connection Flow

```
User clicks "Connect Telegram"
         │
         ▼
┌────────────────────────┐
│ Generate unique token  │  ← 15 min expiry, cryptographically random
│ Store in DB            │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Return deep link:      │
│ t.me/Bot?start=TOKEN   │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ User clicks link       │  ← Opens Telegram app (mobile/desktop)
│ Opens Telegram         │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ User sends /start      │  ← Telegram sends webhook to our API
│ to bot                 │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Webhook handler:       │
│ 1. Validate token      │
│ 2. Mark token as used  │
│ 3. Store chat_id       │
│ 4. Send confirmation   │
└────────────────────────┘
```

### Deep Link Behavior

| Platform | Behavior |
|----------|----------|
| **Mobile (iOS/Android)** | Opens Telegram app directly |
| **Desktop** | Opens Telegram desktop or web |
| **In-app browsers** | May fail (TikTok, Facebook WebView) - warn users |

**Use `https://t.me/` format**, not `tg://` which doesn't work in browsers.

### Webhook Handler

The webhook receives Telegram `/start` commands. For outbound-only notification delivery, use raw `fetch()` to the Telegram Bot API — no framework needed:

```typescript
// Outbound notification delivery — zero dependencies
await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
});
```

For the webhook handler (inbound `/start` command processing), use grammY only if you need middleware, session state, or complex command routing. For simple token validation, raw request parsing is sufficient.

### Verification Token

| Property | Value |
|----------|-------|
| **Format** | 32-byte cryptographically random (Base64URL) |
| **Expiry** | 15 minutes |
| **One-time use** | Mark as used immediately on verification |
| **Rate limit** | 3 tokens per user per hour |

### Credential Storage

| Column | Content |
|--------|---------|
| `telegram_chat_id` | Required for sending messages |
| `telegram_username` | Optional, for display only |
| `is_active` | False if bot blocked |
| `linked_at` | Audit timestamp |

**No tokens stored** - Telegram uses chat_id only.

---

## Discord Channel

### OAuth2 Flow

```
User clicks "Connect Discord"
         │
         ▼
┌────────────────────────┐
│ Generate CSRF state    │  ← Store in HttpOnly cookie
│ Build OAuth URL        │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Redirect to Discord:   │
│ authorize?client_id=   │
│ &redirect_uri=         │
│ &scope=identify        │
│ &state=CSRF            │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ User approves on       │
│ Discord                │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Discord redirects:     │
│ /callback?code=&state= │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Callback handler:      │
│ 1. Validate CSRF state │
│ 2. Exchange code       │
│ 3. Fetch /users/@me    │
│ 4. Store credentials   │
│ 5. Redirect + toast    │
└────────────────────────┘
```

### Required OAuth2 Scopes

| Scope | Purpose |
|-------|---------|
| `identify` | Get user ID and username |

**Note:** The `identify` scope does NOT grant DM permission. See limitation below.

### Critical Limitation: DMs Require Mutual Server

**Discord has no OAuth2 scope for sending DMs to users without a mutual server.**

| Workaround | Implementation |
|------------|----------------|
| **Require mutual server** | User must join app's Discord server to receive DMs |
| **Use webhooks only** | Post to channels, not user DMs |
| **Skip Discord DMs** | Focus on Telegram + Email |

**Recommendation:** If implementing Discord, require users to join a support/community server, then the bot can DM server members.

### Token Management

| Token | Lifetime | Storage |
|-------|----------|---------|
| **Access token** | 7 days (fixed) | Encrypted in DB |
| **Refresh token** | Undocumented | Encrypted in DB |

### Token Refresh Strategy

```
Before sending notification:
         │
         ▼
┌────────────────────────┐
│ Check token_expires_at │
└──────────┬─────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 Valid        Expiring/Expired
    │             │
    │             ▼
    │      ┌────────────────┐
    │      │ POST /token    │
    │      │ grant_type=    │
    │      │ refresh_token  │
    │      └───────┬────────┘
    │              │
    │       ┌──────┴──────┐
    │       ▼             ▼
    │    Success       Failed
    │       │             │
    │       │             ▼
    │       │      Mark inactive
    │       │      Notify user
    │       │
    └───────┴──────────────┐
                           ▼
                   Send notification
```

### Credential Storage

| Column | Content |
|--------|---------|
| `discord_user_id` | For DM channel creation |
| `discord_username` | For display |
| `access_token` | **Encrypted** (AES-256-GCM) |
| `refresh_token` | **Encrypted** (AES-256-GCM) |
| `token_expires_at` | When access token expires |
| `is_active` | False if refresh fails or DMs disabled |

### Token Encryption

| Requirement | Implementation |
|-------------|----------------|
| **Algorithm** | AES-256-GCM (authenticated encryption) |
| **Key management** | Envelope encryption with KMS-backed KEK |
| **Nonce** | Unique 96-bit random per encryption (critical!) |
| **Storage format** | `nonce:ciphertext:tag` (Base64) |

---

## Channel Health Monitoring

### Failure Detection

| Channel | Failure Signal | Action |
|---------|---------------|--------|
| **Telegram** | 403 Forbidden | Bot blocked - mark inactive |
| **Discord** | 50007 error | Cannot DM user - mark inactive |
| **Discord** | 401 Unauthorized | Token expired - attempt refresh |
| **Any** | 3+ consecutive failures | Mark inactive, notify via other channel |

### Inactive Channel UI

When a channel becomes inactive:

```
┌─────────────────────────────────────────┐
│ Telegram                                │
│                                         │
│ ⚠️ Disconnected                          │
│ "Bot was blocked"                       │
│                                         │
│ [Reconnect]                             │
└─────────────────────────────────────────┘
```

---

## Disconnection Flow

### User-Initiated Disconnect

| Step | Action |
|------|--------|
| 1 | User clicks "Disconnect" |
| 2 | Confirmation modal: "Stop receiving {channel} notifications?" |
| 3 | Set `is_active = false`, set `unlinked_at` |
| 4 | For Discord: optionally revoke token at Discord |
| 5 | Show success toast |

**Note:** We soft-delete (set `is_active = false`) rather than hard-delete to:
- Preserve audit trail
- Allow easy reconnection
- Prevent duplicate chat_id/user_id linking

### Cleanup

Background job removes records where `is_active = false` and `unlinked_at < NOW() - 90 days`.

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Token theft** | Encrypt at rest, never log tokens |
| **CSRF in OAuth** | Validate state parameter from secure cookie |
| **Verification token brute-force** | Short expiry, rate limit generation |
| **Replay attacks** | Mark tokens as used immediately |
| **Multi-account abuse** | Unique constraint on telegram_chat_id/discord_user_id |

---

## Related

- [./settings.md](./settings.md) - UI for connection management
- [./schema.md](./schema.md) - Database tables for credentials
- [./routing.md](./routing.md) - How providers use credentials
- [../auth.md](../auth.md) - OAuth2 patterns
