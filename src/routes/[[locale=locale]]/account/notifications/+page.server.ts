import { getNotifications, getUnreadCount } from '$lib/server/db/notifications/queries';
import { PAGE_SIZE } from '$lib/server/notifications/config';
import { renderNotification } from '$lib/server/notifications/render-message';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) return { notifications: [], unreadCount: 0, page: 1, pageSize: PAGE_SIZE };

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const offset = (page - 1) * PAGE_SIZE;

	const [notifications, unreadCount] = await Promise.all([
		getNotifications(locals.user.id, PAGE_SIZE, offset),
		getUnreadCount(locals.user.id),
	]);

	// Render each notification's message in the viewer's request locale.
	// (Locale-rendering at delivery time uses recipient.preferences.locale instead — see
	// $lib/server/jobs/notification-delivery.ts.)
	return {
		notifications: notifications.map((n) => ({
			...n,
			title: renderNotification(n.messageKey, n.messageParams, locals.locale),
			body: null,
			createdAt: n.createdAt.toISOString(),
			readAt: n.readAt?.toISOString() ?? null,
			archivedAt: n.archivedAt?.toISOString() ?? null,
		})),
		unreadCount,
		page,
		pageSize: PAGE_SIZE,
	};
};
