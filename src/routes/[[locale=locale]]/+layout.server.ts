import { building } from '$app/environment';
import { tc } from '$lib/i18n/translate';
import { getActiveAnnouncements } from '$lib/server/admin/announcements';
import { issueConfirmToken } from '$lib/server/analytics/confirm-token';
import { deriveVisitorId } from '$lib/server/analytics/visitor';
import { isAdmin } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals, depends, request, getClientAddress }) => {
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

	// One confirm token per document load, HMAC-bound to this connection's
	// visitor hash (see analytics/confirm-token.ts). Layout server loads do not
	// rerun on SPA navigation, which is exactly the contract: one token, one
	// ping. The hash is otherwise kept off the TTFB path in the pageview hook —
	// one HMAC here beside the announcements query is noise, not a regression.
	// Null while prerendering: there is no client address at build time
	// (getClientAddress throws and fails the build), and prerendered pages are
	// served statically — no collection hook runs for them, so there is no
	// session a baked token could confirm. initConfirmPing(null) is a no-op.
	const analyticsConfirmToken = building
		? null
		: issueConfirmToken(
				await deriveVisitorId(locals.clientIp ?? getClientAddress(), request.headers.get('user-agent') ?? ''),
			);

	return {
		session,
		themeMode,
		sidebarWidth,
		style: locals.style,
		// Single source of truth with the route guards — admin-nav visibility honors ADMIN_USER_ID.
		isAdmin: isAdmin(locals.user),
		announcements,
		debugOwnerActive: locals.debugOwnerId != null,
		analyticsConfirmToken,
		/** Resolved request locale; consumed by formatters via page.data.locale to avoid SSR/CSR drift. */
		locale: locals.locale,
	};
};
