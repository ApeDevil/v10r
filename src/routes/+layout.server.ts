import { env } from '$env/dynamic/private';
import { getActiveAnnouncements } from '$lib/server/admin/announcements';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals, depends }) => {
	depends('app:announcements');
	const session = locals.session
		? {
				expiresAt: locals.session.expiresAt,
				user: {
					id: locals.user?.id,
					email: locals.user?.email,
					name: locals.user?.name,
					image: locals.user?.image ?? null,
				},
			}
		: null;

	// Read theme preference from cookie to prevent flash on full-page reload
	const raw = cookies.get('theme');
	const themeMode: 'light' | 'dark' | 'system' = raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';

	// Read sidebar width from cookie
	const rawWidth = Number(cookies.get('sidebar-width'));
	const sidebarWidth = rawWidth >= 160 && rawWidth <= 320 ? rawWidth : 240;

	// Active announcements for shell banner (cached per user, 30s TTL)
	const announcements = locals.user
		? await getActiveAnnouncements(locals.user.id)
		: [];

	return {
		session,
		themeMode,
		sidebarWidth,
		style: locals.style,
		isAdmin:
			!!locals.user &&
			!!env.ADMIN_EMAIL &&
			locals.user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase(),
		announcements,
	};
};
