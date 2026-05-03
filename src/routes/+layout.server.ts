import { env } from '$env/dynamic/private';
import { tc } from '$lib/i18n/content';
import { getActiveAnnouncements } from '$lib/server/admin/announcements';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals, depends }) => {
	depends('app:announcements');
	const session =
		locals.session && locals.user
			? {
					expiresAt: locals.session.expiresAt,
					user: {
						id: locals.user.id,
						email: locals.user.email,
						name: locals.user.name,
						image: locals.user.image ?? null,
					},
				}
			: null;

	// Read theme preference from cookie to prevent flash on full-page reload
	const raw = cookies.get('theme');
	const themeMode: 'light' | 'dark' | 'system' = raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';

	// Read sidebar width from cookie
	const rawWidth = Number(cookies.get('sidebar-width'));
	const sidebarWidth = rawWidth >= 160 && rawWidth <= 320 ? rawWidth : 240;

	// Active announcements for shell banner (cached per user, 30s TTL).
	// Resolve title/body via tc() at the load edge; cache stays locale-agnostic.
	const rawAnnouncements = locals.user ? await getActiveAnnouncements(locals.user.id) : [];
	const announcements = rawAnnouncements.map((a) => ({
		id: a.id,
		title: tc(a.title, a.titleI18n, locals.locale),
		body: tc(a.body, a.bodyI18n, locals.locale),
		severity: a.severity,
		startsAt: a.startsAt,
		endsAt: a.endsAt,
		createdAt: a.createdAt,
	}));

	return {
		session,
		themeMode,
		sidebarWidth,
		style: locals.style,
		isAdmin: !!locals.user && !!env.ADMIN_EMAIL && locals.user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase(),
		announcements,
		debugOwnerActive: locals.debugOwnerId != null,
		/** Resolved request locale; consumed by formatters via page.data.locale to avoid SSR/CSR drift. */
		locale: locals.locale,
	};
};
