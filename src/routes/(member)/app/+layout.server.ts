import { getUnreadCount } from '$lib/server/db/notifications/queries';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:notifications');

	return {
		user: locals.user!,
		unreadCount: await getUnreadCount(locals.user!.id),
	};
};
