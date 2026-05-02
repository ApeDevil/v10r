import { requireAuth } from '$lib/server/auth/guards';
import { getUnreadCount } from '$lib/server/db/notifications/queries';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	requireAuth(locals, url.pathname + url.search);
	depends('app:notifications');

	return {
		user: locals.user!,
		unreadCount: await getUnreadCount(locals.user!.id),
	};
};
