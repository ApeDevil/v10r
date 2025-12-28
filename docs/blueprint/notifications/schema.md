# Notification Schema

Database tables for multi-channel notification system.

---

## Schema Overview

```
┌──────────────────────┐
│        user          │
└──────────┬───────────┘
           │
     ┌─────┴─────┬────────────────┬──────────────────┐
     │           │                │                  │
     ▼           ▼                ▼                  ▼
┌──────────┐ ┌───────────────┐ ┌────────────────┐ ┌────────────────┐
│user_     │ │user_          │ │notification_   │ │telegram_       │
│telegram_ │ │discord_       │ │preferences     │ │verification_   │
│accounts  │ │accounts       │ │(extended)      │ │tokens          │
└──────────┘ └───────────────┘ └────────────────┘ └────────────────┘
                                       │
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
                    ▼                                      ▼
            ┌──────────────┐                    ┌────────────────────┐
            │notifications │                    │notification_       │
            │  (existing)  │───────────────────▶│deliveries          │
            └──────────────┘                    └────────────────────┘
```

---

## New Tables

### user_telegram_accounts

Stores Telegram chat_id for sending messages.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | text | PK | `tga_xxxxx` |
| `user_id` | text | FK → user, UNIQUE | One Telegram per user |
| `telegram_chat_id` | text | NOT NULL, UNIQUE | Bot sends to this chat |
| `telegram_username` | text | | Display in UI |
| `is_active` | boolean | NOT NULL, DEFAULT true | False if bot blocked |
| `linked_at` | timestamptz | NOT NULL, DEFAULT NOW() | Audit |
| `unlinked_at` | timestamptz | | Soft delete timestamp |

**Indexes:**
- `user_id` (unique) - lookup by user
- `telegram_chat_id` (unique) - prevent duplicate linking

**Design decisions:**
- One-to-one with user (UNIQUE constraint)
- Soft delete via `is_active` + `unlinked_at` for audit trail
- No tokens stored - Telegram uses chat_id only

---

### user_discord_accounts

Stores Discord credentials with OAuth tokens.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | text | PK | `dca_xxxxx` |
| `user_id` | text | FK → user, UNIQUE | One Discord per user |
| `discord_user_id` | text | NOT NULL, UNIQUE | For DM channel creation |
| `discord_username` | text | | Display in UI |
| `access_token` | text | NOT NULL | Encrypted (AES-256-GCM) |
| `refresh_token` | text | NOT NULL | Encrypted (AES-256-GCM) |
| `token_expires_at` | timestamptz | NOT NULL | 7 days from issue |
| `is_active` | boolean | NOT NULL, DEFAULT true | False if refresh fails |
| `token_refresh_failed_at` | timestamptz | | Skip refresh if set |
| `linked_at` | timestamptz | NOT NULL, DEFAULT NOW() | Audit |
| `tokens_refreshed_at` | timestamptz | | Last successful refresh |
| `unlinked_at` | timestamptz | | Soft delete timestamp |

**Indexes:**
- `user_id` (unique) - lookup by user
- `discord_user_id` (unique) - prevent duplicate linking
- Partial index on `token_expires_at` WHERE `is_active = true AND token_refresh_failed_at IS NULL` - for refresh job

**Token encryption:**
- AES-256-GCM with unique 96-bit nonce per encryption
- Envelope encryption with KMS-backed KEK
- Storage format: `nonce:ciphertext:tag` (Base64)

---

### telegram_verification_tokens

Temporary tokens for deep link verification.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | text | PK | `tvt_xxxxx` |
| `user_id` | text | FK → user | Who is linking |
| `token` | text | NOT NULL, UNIQUE | Random 32-byte Base64URL |
| `expires_at` | timestamptz | NOT NULL | 15 minutes from creation |
| `used_at` | timestamptz | | NULL until used |
| `created_at` | timestamptz | NOT NULL, DEFAULT NOW() | Audit |

**Indexes:**
- `token` (unique) - lookup for validation
- Partial index on `expires_at` WHERE `used_at IS NULL` - for cleanup job

**Cleanup:** Delete records where `expires_at < NOW() - INTERVAL '1 day'`

---

### notification_deliveries

Audit log for external channel deliveries.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | text | PK | `ndl_xxxxx` |
| `notification_id` | text | FK → notifications, NOT NULL | Parent notification |
| `channel` | enum | NOT NULL | telegram, discord, email |
| `status` | enum | NOT NULL, DEFAULT pending | pending, processing, sent, failed, skipped |
| `provider_message_id` | text | | External reference for correlation |
| `error_code` | text | | Provider-specific error code |
| `error_message` | text | | Human-readable error |
| `attempts` | integer | NOT NULL, DEFAULT 0 | Retry count |
| `attempted_at` | timestamptz | | Last attempt timestamp |
| `sent_at` | timestamptz | | Successful send timestamp |
| `created_at` | timestamptz | NOT NULL, DEFAULT NOW() | Queue time |

**Enums:**
```sql
CREATE TYPE delivery_status AS ENUM (
  'pending',     -- Queued for send
  'processing',  -- Currently sending
  'sent',        -- Provider accepted
  'failed',      -- Provider rejected (after retries)
  'skipped'      -- Channel inactive, user preference off
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'telegram',
  'discord'
);
```

**Indexes:**
- `notification_id` - lookup deliveries for a notification
- Partial index on `(status, created_at)` WHERE `status = 'failed'` - for retry job
- Partial index on `(status, created_at)` WHERE `status = 'pending'` - for processing

**Retention:**
- `sent` records: 7 days
- `failed` records: 30 days
- `skipped` records: 7 days

---

## Extended Table

### notification_preferences (add columns)

Extend existing table with per-channel toggles.

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `telegram_mention` | boolean | true | Mentions via Telegram |
| `telegram_comment` | boolean | false | Comments via Telegram |
| `telegram_security` | boolean | true | Security via Telegram |
| `telegram_system` | boolean | true | System via Telegram |
| `discord_mention` | boolean | true | Mentions via Discord |
| `discord_comment` | boolean | false | Comments via Discord |
| `discord_security` | boolean | true | Security via Discord |
| `discord_system` | boolean | true | System via Discord |

**Why columns, not junction table?**
- Fixed set of channels (3) and types (4) = 12 columns
- Single row per user, no joins needed
- Simpler queries: `SELECT telegram_mention FROM notification_preferences WHERE user_id = ?`
- Adding a new type = add columns (migration)
- Adding a new channel = add columns (migration, but rare)

**Junction table alternative considered:**
```sql
-- Rejected: more complex queries, no clear benefit for small matrix
CREATE TABLE notification_channel_preferences (
  user_id TEXT,
  notification_type notification_type_enum,
  channel notification_channel,
  enabled BOOLEAN,
  PRIMARY KEY (user_id, notification_type, channel)
);
```

---

## Index Strategy

### Hot Path Queries

| Query | Frequency | Index |
|-------|-----------|-------|
| Get Telegram chat_id for user | Every send | `user_telegram_accounts.user_id` (unique) |
| Get Discord credentials for user | Every send | `user_discord_accounts.user_id` (unique) |
| Get preferences for user | Every send | `notification_preferences.user_id` (PK) |
| Validate verification token | On deep link | `telegram_verification_tokens.token` (unique) |

### Cold Path Queries

| Query | Frequency | Index |
|-------|-----------|-------|
| Tokens needing refresh | Hourly job | Partial on `token_expires_at` |
| Expired verification tokens | Daily cleanup | Partial on `expires_at` |
| Failed deliveries for retry | Periodic | Partial on `status = 'failed'` |
| Deliveries for notification | Debugging | `notification_id` |

### Partial Indexes

Partial indexes reduce size and improve performance for filtered queries:

```sql
-- Only active accounts needing refresh
CREATE INDEX user_discord_accounts_needs_refresh_idx
ON user_discord_accounts (token_expires_at)
WHERE is_active = true AND token_refresh_failed_at IS NULL;

-- Only unused verification tokens
CREATE INDEX telegram_verification_tokens_cleanup_idx
ON telegram_verification_tokens (expires_at)
WHERE used_at IS NULL;

-- Only failed deliveries
CREATE INDEX notification_deliveries_failed_idx
ON notification_deliveries (status, created_at)
WHERE status = 'failed';

-- Only pending deliveries
CREATE INDEX notification_deliveries_pending_idx
ON notification_deliveries (status, created_at)
WHERE status = 'pending';
```

---

## Migration Plan

### Migration 1: Channel Connection Tables

```sql
-- user_telegram_accounts
CREATE TABLE user_telegram_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlinked_at TIMESTAMPTZ
);

-- user_discord_accounts
CREATE TABLE user_discord_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL UNIQUE,
  discord_username TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  token_refresh_failed_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tokens_refreshed_at TIMESTAMPTZ,
  unlinked_at TIMESTAMPTZ
);

CREATE INDEX user_discord_accounts_needs_refresh_idx
ON user_discord_accounts (token_expires_at)
WHERE is_active = true AND token_refresh_failed_at IS NULL;
```

### Migration 2: Verification Tokens

```sql
CREATE TABLE telegram_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX telegram_verification_tokens_cleanup_idx
ON telegram_verification_tokens (expires_at)
WHERE used_at IS NULL;
```

### Migration 3: Extended Preferences

```sql
ALTER TABLE notification_preferences
ADD COLUMN telegram_mention BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN telegram_comment BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN telegram_security BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN telegram_system BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN discord_mention BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN discord_comment BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN discord_security BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN discord_system BOOLEAN NOT NULL DEFAULT true;
```

### Migration 4: Delivery Tracking

```sql
CREATE TYPE delivery_status AS ENUM (
  'pending', 'processing', 'sent', 'failed', 'skipped'
);

CREATE TYPE notification_channel AS ENUM (
  'email', 'telegram', 'discord'
);

CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  status delivery_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notification_deliveries_notification_id_idx
ON notification_deliveries (notification_id);

CREATE INDEX notification_deliveries_failed_idx
ON notification_deliveries (status, created_at)
WHERE status = 'failed';

CREATE INDEX notification_deliveries_pending_idx
ON notification_deliveries (status, created_at)
WHERE status = 'pending';
```

---

## Related

- [./routing.md](./routing.md) - How tables are used in delivery
- [./channels.md](./channels.md) - Connection flows that populate tables
- [../db/relational.md](../db/relational.md) - Full database schema
- [../app-shell/notifications.md](../app-shell/notifications.md) - Existing notifications table
