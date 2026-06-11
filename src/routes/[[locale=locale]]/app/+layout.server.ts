import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { requireAuth } from '$lib/server/auth/guards';
import { getUnreadCount } from '$lib/server/db/notifications/queries';
import { consumeTransparencyMarker, hasSeenTransparency } from '$lib/server/db/preferences';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	const { user } = requireAuth(locals, url.pathname + url.search);
	depends('app:notifications');

	// First sign-in: send the user once to the data-transparency page.
	// Cheap PK read on every nav; the atomic consume (one-shot, prefetch-safe)
	// only runs while the marker is still unset. Self-excludes the target path
	// (the page itself consumes the marker on a direct first visit).
	const onDataPage = url.pathname.includes('/app/account/data');
	if (!(await hasSeenTransparency(user.id))) {
		const firstTime = await consumeTransparencyMarker(user.id);
		if (firstTime && !onDataPage) {
			redirect(303, localizeHref('/app/account/data?welcome=1'));
		}
	}

	return {
		user,
		unreadCount: await getUnreadCount(user.id),
	};
};
