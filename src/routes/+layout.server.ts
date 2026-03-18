import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
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

	return {
		session,
		themeMode,
		sidebarWidth,
		style: locals.style,
	};
};
