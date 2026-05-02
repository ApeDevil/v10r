import { redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import type { Actions, PageServerLoad } from './$types';

interface DeliveryInfo {
	channel: string;
	status: string;
	errorCode: string | null;
}

interface GroupedNotification {
	id: string;
	type: string;
	title: string;
	isRead: boolean;
	createdAt: string;
	deliveries: DeliveryInfo[];
}

async function loadRecentNotifications(userId: string): Promise<GroupedNotification[]> {
	const rows = await db
		.select({
			id: notifications.id,
			type: notifications.type,
			title: notifications.title,
			isRead: notifications.isRead,
			createdAt: notifications.createdAt,
			deliveryChannel: notificationDeliveries.channel,
			deliveryStatus: notificationDeliveries.status,
			errorCode: notificationDeliveries.errorCode,
		})
		.from(notifications)
		.leftJoin(notificationDeliveries, eq(notificationDeliveries.notificationId, notifications.id))
		.where(eq(notifications.userId, userId))
		.orderBy(desc(notifications.createdAt))
		.limit(100);

	// Group by notification ID
	const map = new Map<string, GroupedNotification>();

	for (const row of rows) {
		if (!map.has(row.id)) {
			map.set(row.id, {
				id: row.id,
				type: row.type,
				title: row.title,
				isRead: row.isRead,
				createdAt: row.createdAt.toISOString(),
				deliveries: [],
			});
		}

		if (row.deliveryChannel) {
			map.get(row.id)?.deliveries.push({
				channel: row.deliveryChannel,
				status: row.deliveryStatus ?? 'pending',
				errorCode: row.errorCode,
			});
		}
	}

	return [...map.values()].slice(0, 20);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/login');

	const recentNotifications = await loadRecentNotifications(locals.user.id);

	return { title: 'Pipeline - Notifications - Showcases', recentNotifications };
};

export const actions: Actions = {
	refresh: async ({ locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const recentNotifications = await loadRecentNotifications(locals.user.id);

		return { recentNotifications };
	},
};
