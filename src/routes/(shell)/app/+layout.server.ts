import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getUnreadCount } from '$lib/server/db/notifications/queries';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	// Defense-in-depth: hooks routeGuard already catches this,
	// but double-check in case route is accessed via preload
	if (!locals.user) {
		redirect(303, '/auth/login');
	}

	depends('app:notifications');

	return {
		user: locals.user,
		isAdmin: !!env.ADMIN_EMAIL && locals.user.email === env.ADMIN_EMAIL,
		unreadCount: await getUnreadCount(locals.user.id),
	};
};
