# Notifications

In-app notification system with a full-page notification center, preference management, and an SSE stream (`/api/notifications/stream`) for clients that want live updates. The app shell itself renders the unread count from the page load; the stream's in-repo consumer is the notifications pipeline showcase.

**Runtime model:** SSE either way, with the *transport* chosen by platform capability. On a persistent host an in-memory connection map is sufficient. On serverless each instance has its own module scope, so events travel over Redis pub/sub and every stream subscribes on connect. (There is no polling fallback — an earlier version of this document described one that was never built.)

## Route Structure

```
/account/notifications/
├── +page.svelte             # Notification center (inbox)
├── +page.server.ts          # Load notifications, mark as read
└── settings/
    ├── +page.svelte         # Email & push channel settings
    └── +page.server.ts      # Save settings
```

---

## Access Pattern

**Two entry points:**

1. **Account tab** — the `Notifications` tab in `account/+layout.svelte` (bell icon, no badge)
2. **Direct navigation** — `/account/notifications` for deep linking (`?n=<id>` focuses one notification)

**Why full page (not modal)?**
- Mobile-friendly (avoids modal scroll issues)
- Supports deep linking to specific notifications
- Cleaner navigation model
## Notification Center

**Route:** `/account/notifications`

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
  import { getToast } from '$lib/state';

  const toast = getToast();
  let { data } = $props();
  let filter = $state<'all' | 'mentions' | 'system'>('all');

  let filtered = $derived(
    filter === 'all'
      ? data.notifications
      : data.notifications.filter(n => n.type === filter)
  );

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
    <a href="/account/notifications/settings" class="btn-icon">
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


## Notification Settings

**Route:** `/account/notifications/settings`

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

### Runtime-Adaptive Approach

| Runtime | Transport | Latency | Mechanism |
|---|---|---|---|
| **Container (primary)** | SSE + in-memory connection map | ~instant | `notifyUser()` enqueues onto open streams |
| **Vercel serverless** | SSE + Redis pub/sub | ~instant | `notifyUser()` PUBLISHes; each stream SUBSCRIBEs on connect |

SSE works naturally in a persistent Bun process — in-memory state survives across requests and connections stay open indefinitely. On Vercel that assumption breaks: the instance that creates a notification is almost never the instance parked on the client's `EventSource`, so a memory-only enqueue reaches nobody. `stream.ts` therefore selects on `platform.persistent`, and on the pub/sub path the emitter does **not** also enqueue locally — the local stream is itself a subscriber, so one publish is one delivery.

**Limits worth knowing.** Redis pub/sub is fire-and-forget with no replay: anything published while a client is between reconnects is lost. The route re-sends an `init` frame with the authoritative unread count on every connect, so the badge self-heals within one reconnect (≤55s), but per-item replay via `id:` / `Last-Event-ID` is not built. `SSE_MAX_PER_USER` is also a per-instance cap on serverless — the effective global control is the Redis-backed connect rate limiter, not that constant.

### Container: SSE with In-Memory Connection Map

```typescript
// src/lib/server/notifications/stream.ts
// In-process connection registry — works because Bun is a persistent process

const userStreams = new Map<string, Set<ReadableStreamDefaultController>>();

/** Push a notification event to all open SSE connections for a user */
export function notifyUser(userId: string, payload: unknown) {
  const controllers = userStreams.get(userId);
  if (!controllers) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = new TextEncoder().encode(data);
  for (const ctrl of controllers) {
    try { ctrl.enqueue(encoded); } catch { /* connection gone */ }
  }
}

export function registerStream(userId: string, ctrl: ReadableStreamDefaultController) {
  if (!userStreams.has(userId)) userStreams.set(userId, new Set());
  userStreams.get(userId)!.add(ctrl);
}

export function unregisterStream(userId: string, ctrl: ReadableStreamDefaultController) {
  userStreams.get(userId)?.delete(ctrl);
  if (userStreams.get(userId)?.size === 0) userStreams.delete(userId);
}
```

```typescript
// src/routes/api/notifications/stream/+server.ts
import type { RequestHandler } from './$types';
import { registerStream, unregisterStream } from '$lib/server/notifications/stream';
import { getUnreadCount } from '$lib/server/notifications/queries';

const MAX_PER_USER = 3;

export const GET: RequestHandler = async ({ locals, request }) => {
  if (!locals.user || !locals.session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = locals.user.id;
  const abortSignal = request.signal;
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    async start(ctrl) {
      controller = ctrl;
      registerStream(userId, ctrl);

      // Send initial unread count
      const count = await getUnreadCount(userId);
      ctrl.enqueue(new TextEncoder().encode(
        `data: ${JSON.stringify({ type: 'init', count })}\n\n`
      ));

      // Heartbeat keeps connection alive through proxies
      const heartbeat = setInterval(() => {
        try { ctrl.enqueue(new TextEncoder().encode(': heartbeat\n\n')); }
        catch { clearInterval(heartbeat); }
      }, 25_000);

      // Cleanup on client disconnect
      abortSignal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unregisterStream(userId, ctrl);
        try { ctrl.close(); } catch { /* already closed */ }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
};
```

**Trigger from anywhere** — after creating a notification in any form action or API route:

```typescript
import { notifyUser } from '$lib/server/notifications/stream';

// After DB insert:
notifyUser(targetUserId, { type: 'new', count: newUnreadCount, title: notification.title });
```

### Client-Side SSE Consumer

The in-repo consumer is the notifications pipeline showcase (`showcases/notifications/pipeline/+page.svelte`): one `EventSource('/api/notifications/stream')`, `init` sets the count from the authoritative server value, `new` increments it. The account pages do not hold a stream open — mark-read calls `invalidate('app:notifications')`, which re-runs the notifications page load (`depends('app:notifications')`) so the list and the count come back from the database.

### SSE Security Hardening

Long-lived SSE connections require careful security handling.

#### Authentication & Session Validation

```typescript
// In the SSE endpoint — verify session on connect
if (!locals.session || !locals.user) {
  return new Response('Unauthorized', { status: 401 });
}
if (new Date(locals.session.expiresAt) < new Date()) {
  return new Response('Session expired', { status: 401 });
}
```

For session expiry during a long-lived connection, the heartbeat interval can re-validate the session and send a `session-expired` event:

```typescript
// Inside heartbeat interval:
const session = await getSession(sessionToken);
if (!session || new Date(session.expiresAt) < new Date()) {
  ctrl.enqueue(encoder.encode('event: session-expired\ndata: {}\n\n'));
  ctrl.close();
  return;
}
```

```typescript
// Client handles session expiry:
eventSource.addEventListener('session-expired', () => {
  eventSource.close();
  showSessionExpiredModal();
});
```

#### Connection Limits

Prevent resource exhaustion — max 3 SSE connections per user:

```typescript
const existing = userStreams.get(userId)?.size ?? 0;
if (existing >= MAX_PER_USER) {
  return new Response('Too many connections', { status: 429 });
}
```

### Reconnection & Catch-Up

On reconnect after a drop, the client may have missed events. Two approaches:

**Simple (recommended):** Always send the current unread count as the `init` event on every reconnect. Badge accuracy is restored without event replay.

**Advanced:** Use SSE `id:` fields + `Last-Event-ID` header for event replay:

```typescript
// Server: include event IDs
ctrl.enqueue(encoder.encode(`id: ${notification.id}\ndata: ${JSON.stringify(payload)}\n\n`));

// On reconnect, check Last-Event-ID and send missed notifications
const lastEventId = request.headers.get('last-event-id');
if (lastEventId) {
  const missed = await getNotificationsSince(userId, lastEventId);
  for (const n of missed) {
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(n)}\n\n`));
  }
}
```

### Future Upgrade Path: External Real-Time Service

If SSE + in-memory map proves insufficient at scale (multiple container instances), consider:

| Service | Free Tier | Notes |
|---|---|---|
| **Ably** | 200 connections, 6M msg/month | Best free tier, global edge |
| **Pusher** | 100 connections, 200K msg/day | Most proven, transparent pricing |
| **Upstash Realtime** | Included with Redis | Same vendor, Redis Streams-based |

Replace the in-memory map with a pub/sub broker; the rest of the architecture stays the same.

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
  groupKey: text('group_key'),    // For collapsing: "Alice and 3 others commented..."
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

  // Telegram + Discord columns added in schema extension
  // See ../notifications/schema.md for telegram_* and discord_* columns

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

Automated cleanup prevents table bloat. Runs as a registered job in the existing job runner (container: `setInterval`, Vercel: cron).

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
└── NotificationFilters.svelte   # Filter tabs
```

### Data Loading

The notifications page load (`account/notifications/+page.server.ts`) fetches the page of notifications and the unread count in one parallel wave and declares `depends('app:notifications')`; the page's mark-read handlers call `invalidate('app:notifications')` after the POST succeeds. No client-side count state — the database stays the single source of truth.


## Related

- [./sidebar.md](./sidebar.md) - Notification trigger in sidebar
- [../db/relational.md](../db/relational.md) - Full schema
- [../auth.md](../auth.md) - Session cleanup pattern (apply to notifications)
- [../notifications/](../notifications/) - **Multi-channel delivery** (Email, Telegram, Discord)
