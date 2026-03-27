import { NOTIFICATIONS_PAGE_SIZE } from '$lib/server/config';
import { getNotifications, getUnreadCount } from '$lib/server/db/notifications/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const offset = (page - 1) * NOTIFICATIONS_PAGE_SIZE;

	const [notifications, unreadCount] = await Promise.all([
		getNotifications(locals.user?.id, NOTIFICATIONS_PAGE_SIZE, offset),
		getUnreadCount(locals.user?.id),
	]);

	return {
		notifications: notifications.map((n) => ({
			...n,
			createdAt: n.createdAt.toISOString(),
			readAt: n.readAt?.toISOString() ?? null,
			archivedAt: n.archivedAt?.toISOString() ?? null,
		})),
		unreadCount,
		page,
		pageSize: NOTIFICATIONS_PAGE_SIZE,
	};
};
