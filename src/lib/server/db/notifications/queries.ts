import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { notifications } from '../schema/notifications/notifications';
import { pushSubscriptions } from '../schema/notifications/push-subscriptions';

/** List notifications for a user, most recent first */
export async function getNotifications(userId: string, limit: number, offset: number) {
	return db
		.select()
		.from(notifications)
		.where(and(eq(notifications.userId, userId), sql`${notifications.archivedAt} IS NULL`))
		.orderBy(desc(notifications.createdAt))
		.limit(limit)
		.offset(offset);
}

/** Count unread notifications for a user */
export async function getUnreadCount(userId: string): Promise<number> {
	const [result] = await db
		.select({ count: count() })
		.from(notifications)
		.where(
			and(eq(notifications.userId, userId), eq(notifications.isRead, false), sql`${notifications.archivedAt} IS NULL`),
		);
	return result?.count ?? 0;
}

/**
 * Notifications created since `since`, oldest first — the digest body.
 *
 * Read AND unread are both included: a digest is a summary of the window, not
 * an inbox, and filtering to unread would make the mail contradict itself for
 * anyone who checked the app in between. `limit` bounds the render; the caller
 * reports the overflow rather than silently truncating.
 */
export async function getNotificationsSince(userId: string, since: Date, limit: number) {
	return db
		.select({
			id: notifications.id,
			type: notifications.type,
			messageKey: notifications.messageKey,
			messageParams: notifications.messageParams,
			createdAt: notifications.createdAt,
		})
		.from(notifications)
		.where(
			and(
				eq(notifications.userId, userId),
				sql`${notifications.createdAt} > ${since}`,
				sql`${notifications.archivedAt} IS NULL`,
			),
		)
		.orderBy(notifications.createdAt)
		.limit(limit);
}

/** Get a single notification (auth-scoped) */
export async function getNotificationById(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(notifications)
		.where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** All push subscriptions (devices) for a user. */
export async function getPushSubscriptions(userId: string) {
	return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}
