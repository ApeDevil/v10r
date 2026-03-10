import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { notifications } from '../schema/notifications/notifications';

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

/** Get a single notification (auth-scoped) */
export async function getNotificationById(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(notifications)
		.where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
		.limit(1);
	return row ?? null;
}
