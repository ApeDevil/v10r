# Notifications

In-app notification system with full-page notification center, preference management, and real-time updates.

## Route Structure

```
/app/notifications/
├── +page.svelte             # Notification center (inbox)
├── +page.server.ts          # Load notifications, mark as read
└── settings/
    ├── +page.svelte         # Email & push channel settings
    └── +page.server.ts      # Save settings
```

---

## Access Pattern

**Two entry points:**

1. **Sidebar bell icon** - Badge shows unread count, click navigates to center
2. **Direct navigation** - `/app/notifications` for deep linking

```
Sidebar Header:
┌──────────────────────┐
│  Logo                │
│  🔍 Search...    ⌘K  │
│  💬 Ask AI...    ⌘J  │
│  🔔 Notifications (3)│ ← Badge with unread count
└──────────────────────┘
```

**Why full page (not modal)?**
- Mobile-friendly (avoids modal scroll issues)
- Supports deep linking to specific notifications
- Cleaner navigation model

---

## Notification Center

**Route:** `/app/notifications`

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Notifications                      [⚙️ Settings]  │
├────────────────────────────────────────────────────┤
│                                                    │
│ [All] [Mentions] [System]    Mark all as read     │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ 🔵 @alice mentioned you in "Project Alpha"  │  │
│ │ "Great work on the new feature!"             │  │
│ │ 2 hours ago                          [Mark]  │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ ⚠️ System maintenance scheduled              │  │
│ │ Scheduled downtime on Jan 20, 2:00 AM UTC    │  │
│ │ 1 day ago                                    │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ ✓ Export ready                               │  │
│ │ Your data export is ready to download        │  │
│ │ 3 days ago                          [Delete] │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│                 (Load more...)                     │
└────────────────────────────────────────────────────┘
```

### Notification Types

| Type | Icon | Use Case |
|------|------|----------|
| `mention` | 🔵 | User mentioned in comment |
| `comment` | 💬 | Reply to comment |
| `system` | ⚠️ | Maintenance, updates |
| `success` | ✓ | Export ready, task complete |
| `security` | 🔴 | Security alert, login from new device |
| `follow` | 👤 | Someone followed you |

### Interaction Patterns

| Action | Behavior |
|--------|----------|
| Click notification | Navigate to related resource |
| Click "Mark" | Mark single as read (optimistic update) |
| Click "Mark all as read" | Bulk action with success toast |
| Click "Delete" | Remove notification |
| Swipe left (mobile) | Reveal mark/delete actions |

### Empty State

```
┌────────────────────────────┐
│           🔔               │
│                            │
│ You're all caught up!      │
│                            │
│ We'll notify you when      │
│ something needs your       │
│ attention.                 │
└────────────────────────────┘
```

### Implementation

```svelte
<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { toast } from '$lib/components/ui/toast';

  let { data } = $props();
  let filter = $state<'all' | 'mentions' | 'system'>('all');

  let filtered = $derived(() => {
    if (filter === 'all') return data.notifications;
    return data.notifications.filter(n => n.type === filter);
  });

  async function markAsRead(id: string) {
    // Optimistic update
    const notification = data.notifications.find(n => n.id === id);
    if (notification) notification.read = true;

    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    invalidate('app:notifications');
  }

  async function markAllAsRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    invalidate('app:notifications');
    toast.success('All notifications marked as read');
  }
</script>

<PageHeader title="Notifications">
  {#snippet actions()}
    <a href="/app/notifications/settings" class="btn-icon">
      <span class="i-lucide-settings" />
    </a>
  {/snippet}
</PageHeader>

<div class="filters">
  <button class:active={filter === 'all'} onclick={() => filter = 'all'}>All</button>
  <button class:active={filter === 'mentions'} onclick={() => filter = 'mentions'}>Mentions</button>
  <button class:active={filter === 'system'} onclick={() => filter = 'system'}>System</button>

  <button onclick={markAllAsRead} class="ml-auto">Mark all as read</button>
</div>

{#each filtered as notification}
  <NotificationCard
    {notification}
    onmarkread={() => markAsRead(notification.id)}
  />
{:else}
  <EmptyState icon="bell" title="You're all caught up!" />
{/each}
```

---

## Sidebar Notification Trigger

```svelte
<!-- src/lib/components/shell/SidebarNotifications.svelte -->
<script lang="ts">
  import { Popover } from 'bits-ui';
  import { NotificationPreview, NotificationBadge } from '$lib/components/composites/notifications';

  let { notifications, unreadCount } = $props();
</script>

<!-- Desktop: Popover preview -->
<Popover.Root>
  <Popover.Trigger class="notification-trigger">
    <span class="i-lucide-bell" />
    {#if unreadCount > 0}
      <NotificationBadge count={unreadCount} />
    {/if}
  </Popover.Trigger>

  <Popover.Content side="right" align="start" class="w-80">
    <NotificationPreview {notifications} />
    <a href="/app/notifications" class="view-all">View all</a>
  </Popover.Content>
</Popover.Root>

<!-- Mobile: Direct link (no popover) -->
<a href="/app/notifications" class="notification-trigger md:hidden">
  <span class="i-lucide-bell" />
  {#if unreadCount > 0}
    <NotificationBadge count={unreadCount} />
  {/if}
</a>
```

---

## Notification Settings

**Route:** `/app/notifications/settings`

### Wireframe

```
┌─────────────────────────────────────────┐
│ Notification Settings                   │
├─────────────────────────────────────────┤
│                                         │
│ Email Notifications                     │
│                                         │
│ ☑ Mentions and replies                  │
│ ☑ Project updates                       │
│ ☑ System announcements                  │
│ ☑ Security alerts (required)  ← locked  │
│                                         │
│ Frequency                               │
│ ○ Real-time                             │
│ ● Daily digest                          │
│ ○ Weekly digest                         │
│                                         │
│ Push Notifications                      │
│                                         │
│ ☑ Mentions and replies                  │
│ ☑ Security alerts (required)  ← locked  │
│                                         │
│ Quiet Hours                             │
│                                         │
│ ☐ Enable quiet hours                    │
│ From: [22:00] To: [08:00]               │
│                                         │
│ [Cancel]  [Save Settings]               │
└─────────────────────────────────────────┘
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Security alerts cannot be disabled | Critical for account security |
| Quiet hours option | Reduce notification fatigue |
| Digest frequency | Batch emails for less inbox clutter |
| Per-channel toggles | Granular control over email vs push |

---

## Real-Time Updates Strategy

### Option 1: Polling (MVP)

Simple, works everywhere, serverless-friendly.

```typescript
// Poll every 30 seconds
setInterval(async () => {
  const res = await fetch('/api/notifications/unread-count');
  const { count } = await res.json();
  unreadCount = count;
}, 30_000);
```

### Option 2: Server-Sent Events (Recommended)

One-way server → client push. More efficient than polling.

```typescript
// src/routes/api/notifications/stream/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial count
      const count = await getUnreadCount(userId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ count })}\n\n`));

      // Subscribe to new notifications (e.g., via Redis pub/sub)
      const unsubscribe = subscribeToNotifications(userId, (notification) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(notification)}\n\n`));
      });

      // Cleanup on disconnect
      return () => unsubscribe();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
```

```typescript
// Client-side
const eventSource = new EventSource('/api/notifications/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  unreadCount = data.count;
};
```

### SSE Security Hardening

**Critical:** Long-lived SSE connections require careful security handling.

#### Authentication

```typescript
// src/routes/api/notifications/stream/+server.ts
export const GET: RequestHandler = async ({ locals, url }) => {
  // 1. Verify session exists
  if (!locals.session || !locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Check session not expired
  if (new Date(locals.session.expiresAt) < new Date()) {
    return new Response('Session expired', { status: 401 });
  }

  // 3. Optional: CSRF token for extra protection
  const csrfToken = url.searchParams.get('csrf');
  if (!csrfToken || csrfToken !== locals.session.csrfToken) {
    return new Response('Invalid CSRF token', { status: 403 });
  }

  const userId = locals.user.id;
  // ... rest of SSE setup
};
```

#### Client with Credentials

```typescript
// Client-side - ensure cookies are sent
const eventSource = new EventSource('/api/notifications/stream?csrf=' + csrfToken, {
  withCredentials: true, // Required for cookies
});

// Handle auth errors
eventSource.onerror = (event) => {
  if (eventSource.readyState === EventSource.CLOSED) {
    // Connection closed, likely auth issue
    handleSessionExpiry();
  }
};
```

#### Heartbeat & Timeout

Detect stale connections and session expiry during long-lived connections:

```typescript
// Server: Send heartbeat every 30 seconds
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    let sessionValid = true;

    // Heartbeat interval
    const heartbeat = setInterval(async () => {
      // Re-check session validity
      const session = await getSession(sessionToken);
      if (!session || new Date(session.expiresAt) < new Date()) {
        sessionValid = false;
        controller.enqueue(encoder.encode('event: session-expired\ndata: {}\n\n'));
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(': heartbeat\n\n'));
    }, 30_000);

    // Cleanup
    return () => {
      clearInterval(heartbeat);
    };
  }
});
```

```typescript
// Client: Handle session expiry event
eventSource.addEventListener('session-expired', () => {
  eventSource.close();
  showSessionExpiredModal();
});

// Reconnect on transient errors
let reconnectAttempts = 0;
const maxReconnects = 5;

eventSource.onerror = () => {
  if (reconnectAttempts < maxReconnects) {
    setTimeout(() => {
      reconnectAttempts++;
      connectSSE(); // Recreate EventSource
    }, Math.min(1000 * 2 ** reconnectAttempts, 30000)); // Exponential backoff
  }
};
```

#### Connection Limits

Prevent resource exhaustion from too many SSE connections:

```typescript
// Track active connections per user
const activeConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_USER = 3;

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user.id;
  const current = activeConnections.get(userId) ?? 0;

  if (current >= MAX_CONNECTIONS_PER_USER) {
    return new Response('Too many connections', { status: 429 });
  }

  activeConnections.set(userId, current + 1);

  // Decrement on disconnect
  const cleanup = () => {
    const count = activeConnections.get(userId) ?? 1;
    activeConnections.set(userId, count - 1);
  };

  // ... SSE setup with cleanup in cancel handler
};
```

---

## Authorization

**Critical:** Always verify the user owns the notification before any operation.

```typescript
// src/routes/api/notifications/[id]/read/+server.ts
export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, params.id),
  });

  // IDOR prevention: verify ownership
  if (!notification || notification.userId !== locals.user.id) {
    return json({ error: 'Not found' }, { status: 404 });
  }

  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, params.id));

  return json({ success: true });
};
```

---

## Data Model

### Notifications Table

```typescript
export const notificationTypeEnum = pgEnum('notification_type', [
  'system', 'mention', 'comment', 'follow', 'like', 'share', 'reminder', 'security'
]);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  actorId: text('actor_id')
    .references(() => user.id, { onDelete: 'set null' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  entityRef: text('entity_ref'),  // "type:id" format
  actionUrl: text('action_url'),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true })
});
```

### Indexes (Optimized)

```sql
-- Composite index for user's notifications in order
CREATE INDEX idx_notifications_user_created
ON notifications (user_id, created_at DESC);

-- Partial index for unread only (more efficient!)
CREATE INDEX idx_notifications_unread
ON notifications (user_id, created_at DESC)
WHERE is_read = false;
```

### Notification Settings Table

Notification channel configuration is a **Setting** (affects functionality) per [../../foundation/user-data.md](../../foundation/user-data.md).

```typescript
export const digestFrequencyEnum = pgEnum('digest_frequency', [
  'instant', 'daily', 'weekly', 'never'
]);

export const notificationSettings = pgTable('notification_settings', {
  userId: text('user_id').primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  // Email preferences per type
  emailMention: boolean('email_mention').notNull().default(true),
  emailComment: boolean('email_comment').notNull().default(true),
  emailSecurity: boolean('email_security').notNull().default(true), // Cannot disable
  emailSystem: boolean('email_system').notNull().default(true),

  // Push preferences
  pushMention: boolean('push_mention').notNull().default(true),
  pushSecurity: boolean('push_security').notNull().default(true),

  // Digest settings
  emailDigestFrequency: digestFrequencyEnum('email_digest_frequency')
    .notNull().default('instant'),

  // Quiet hours
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
  quietHoursStart: text('quiet_hours_start').default('22:00'),
  quietHoursEnd: text('quiet_hours_end').default('08:00'),

  // Global mute (vacation mode)
  mutedUntil: timestamp('muted_until', { withTimezone: true }),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
```

---

## Notification Cleanup

Automated cleanup prevents table bloat.

```typescript
// src/lib/server/jobs/notification-cleanup.ts
export async function cleanupNotifications() {
  const now = new Date();

  // Archive read notifications older than 30 days
  const archiveCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await db.update(notifications)
    .set({ archivedAt: now })
    .where(and(
      eq(notifications.isRead, true),
      lt(notifications.createdAt, archiveCutoff),
      isNull(notifications.archivedAt)
    ));

  // Hard delete archived notifications older than 90 days
  const deleteCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  await db.delete(notifications)
    .where(and(
      isNotNull(notifications.archivedAt),
      lt(notifications.archivedAt, deleteCutoff)
    ));
}
```

---

## Query Examples

```typescript
// Get unread notifications for user
export async function getUnreadNotifications(userId: string, limit = 20) {
  return db.query.notifications.findMany({
    where: and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      isNull(notifications.archivedAt)
    ),
    with: { actor: true },
    orderBy: desc(notifications.createdAt),
    limit
  });
}

// Get unread count
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      isNull(notifications.archivedAt)
    ));
  return result[0]?.count ?? 0;
}

// Mark all as read
export async function markAllAsRead(userId: string) {
  return db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
}
```

---

## Components

```
src/lib/components/composites/notifications/
├── NotificationCenter.svelte    # Full page list
├── NotificationCard.svelte      # Single notification row
├── NotificationPreview.svelte   # Popover preview (desktop)
├── NotificationBadge.svelte     # Unread count indicator
└── NotificationFilters.svelte   # Filter tabs
```

---

## Related

- [./sidebar.md](./sidebar.md) - Notification trigger in sidebar
- [../db/relational.md](../db/relational.md) - Full schema
- [../auth.md](../auth.md) - Session cleanup pattern (apply to notifications)
- [../notifications/](../notifications/) - **Multi-channel delivery** (Email, Telegram, Discord)
