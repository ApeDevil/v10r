import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { rowsOf } from '../rows';
import { notificationSettings } from '../schema/notifications/notification-settings';
import { type NotificationParams, notifications } from '../schema/notifications/notifications';
import { pushSubscriptions } from '../schema/notifications/push-subscriptions';

interface CreateNotificationInput {
	userId: string;
	actorId?: string;
	type: 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow';
	/** Paraglide message key resolved at render time (e.g. 'notif_feedback_received'). */
	messageKey: string;
	/** ICU interpolation values for the message. Defaults to {}. */
	messageParams?: NotificationParams;
	entityRef?: string;
	groupKey?: string;
	actionUrl?: string;
}

/** Create a new notification record */
export async function createNotification(data: CreateNotificationInput) {
	const [row] = await db
		.insert(notifications)
		.values({
			id: crypto.randomUUID(),
			messageParams: data.messageParams ?? {},
			...data,
		})
		.returning();
	return row;
}

/** Mark a single notification as read (IDOR-safe: requires userId) */
export async function markAsRead(id: string, userId: string) {
	const [row] = await db
		.update(notifications)
		.set({ isRead: true, readAt: new Date() })
		.where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
		.returning({ id: notifications.id });
	return !!row;
}

/** Mark all unread notifications as read for a user */
export async function markAllAsRead(userId: string) {
	const rows = await db
		.update(notifications)
		.set({ isRead: true, readAt: new Date() })
		.where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
		.returning({ id: notifications.id });
	return rows.length;
}

/** Get or create notification settings for a user */
export async function getOrCreateSettings(userId: string) {
	const [existing] = await db
		.select()
		.from(notificationSettings)
		.where(eq(notificationSettings.userId, userId))
		.limit(1);

	if (existing) return existing;

	const [created] = await db.insert(notificationSettings).values({ userId }).onConflictDoNothing().returning();

	// Race condition: another request may have inserted between select and insert
	if (!created) {
		const [row] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
		return row;
	}

	return created;
}

/**
 * The notification row a digest's deliveries hang off.
 *
 * `notification_deliveries.notification_id` is NOT NULL with an ON DELETE
 * CASCADE FK, so a delivery cannot exist without one — and a digest summarizes
 * N notifications rather than being one. This row carries the SUBJECT
 * (`notif_digest_subject` + `{count}`); the body rides on the delivery's
 * `body_override`.
 *
 * Created pre-archived on purpose: `archived_at` is set, so it never appears in
 * the in-app inbox or the unread count (both filter on it). It exists to satisfy
 * the FK and to give the worker a subject to render in the recipient's locale —
 * duplicating the digest back into the inbox it summarizes would be noise.
 */
export async function createDigestCarrier(userId: string, count: number) {
	const now = new Date();
	const [row] = await db
		.insert(notifications)
		.values({
			id: crypto.randomUUID(),
			userId,
			type: 'system',
			messageKey: 'notif_digest_subject',
			messageParams: { count } as NotificationParams,
			archivedAt: now,
		})
		.returning();
	return row;
}

/**
 * Atomically claim the users whose digest is due, stamping `last_digest_at` in
 * the same statement that selects them.
 *
 * IDEMPOTENCY, NOT A LOCK. The `last_digest_at < cutoff OR IS NULL` predicate
 * is the fence: a second cron fire within the same window matches zero rows and
 * sends nothing. This is the same shape as `claimDeliveries` in the outbox, and
 * for the same reason it is ONE statement — `db.transaction()` takes the
 * WebSocket path that Bun mishandles.
 *
 * Returns the claimed rows with the PREVIOUS `last_digest_at`, which is the
 * aggregation lower bound. Null there means "never sent" and the caller falls
 * back to one interval.
 */
export async function claimDigestRecipients(
	frequency: 'daily' | 'weekly',
	cutoff: Date,
): Promise<{ userId: string; previousDigestAt: Date | null }[]> {
	// `RETURNING` yields the NEW row, so the previous timestamp has to be
	// captured in a sub-select before the SET overwrites it. `FOR UPDATE` keeps
	// two concurrent runs from claiming the same user — same shape as
	// `claimDeliveries`, minus SKIP LOCKED (a contended row here should wait and
	// then see the fence, not be silently skipped).
	const rows = await db.execute<{ user_id: string; previous_digest_at: Date | null }>(sql`
		UPDATE notifications.notification_settings AS s
		SET last_digest_at = now()
		FROM (
			SELECT user_id, last_digest_at
			FROM notifications.notification_settings
			WHERE digest_frequency = ${frequency}
			  AND (last_digest_at IS NULL OR last_digest_at < ${cutoff})
			FOR UPDATE
		) AS prev
		WHERE s.user_id = prev.user_id
		RETURNING s.user_id, prev.last_digest_at AS previous_digest_at
	`);
	// The two drivers disagree on the result shape — `rowsOf` is the shim.
	return rowsOf<{ user_id: string; previous_digest_at: Date | string | null }>(rows).map((r) => ({
		userId: r.user_id,
		previousDigestAt: r.previous_digest_at ? new Date(r.previous_digest_at) : null,
	}));
}

/** Update notification settings for a user */
export async function updateSettings(
	userId: string,
	data: Partial<Omit<typeof notificationSettings.$inferInsert, 'userId'>>,
) {
	const [row] = await db
		.update(notificationSettings)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(notificationSettings.userId, userId))
		.returning();
	return row;
}

/** Devices per user cap — the push send path fans out synchronously, so an
 * unbounded N is a self-DoS. Oldest subscriptions are evicted first. */
const PUSH_SUBSCRIPTIONS_PER_USER_MAX = 10;

/** Register (or refresh) a push subscription for a device. Idempotent on endpoint. */
export async function createPushSubscription(
	userId: string,
	subscription: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null },
) {
	// Endpoint is device-unique: a re-subscribe from the same device updates keys.
	const [row] = await db
		.insert(pushSubscriptions)
		.values({ id: crypto.randomUUID(), userId, ...subscription })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId, p256dh: subscription.p256dh, auth: subscription.auth, userAgent: subscription.userAgent },
		})
		.returning();

	// Enforce the per-user cap (self-healing: 410-pruning keeps this rare).
	const all = await db
		.select({ id: pushSubscriptions.id })
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))
		.orderBy(asc(pushSubscriptions.createdAt));
	if (all.length > PUSH_SUBSCRIPTIONS_PER_USER_MAX) {
		const excess = all.slice(0, all.length - PUSH_SUBSCRIPTIONS_PER_USER_MAX);
		for (const sub of excess) {
			await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
		}
	}

	return row;
}

/** Remove one device's subscription (IDOR-safe: requires userId). */
export async function deletePushSubscription(userId: string, endpoint: string) {
	const rows = await db
		.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
		.returning({ id: pushSubscriptions.id });
	return rows.length > 0;
}

/** Prune a dead endpoint (push service answered 404/410 — device unsubscribed). */
export async function deletePushSubscriptionByEndpoint(endpoint: string) {
	await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Stamp delivery time on a subscription (fire-and-forget from the provider). */
export async function touchPushSubscription(endpoint: string) {
	await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(eq(pushSubscriptions.endpoint, endpoint));
}
