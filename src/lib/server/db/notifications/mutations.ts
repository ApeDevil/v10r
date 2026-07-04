import { and, asc, eq } from 'drizzle-orm';
import { db } from '../index';
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
