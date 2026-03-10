import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { notificationSettings } from '../schema/notifications/notification-settings';
import { notifications } from '../schema/notifications/notifications';

interface CreateNotificationInput {
	userId: string;
	actorId?: string;
	type: 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow';
	title: string;
	body?: string;
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
