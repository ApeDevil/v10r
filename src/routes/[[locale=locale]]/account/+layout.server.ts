import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { requireAuth } from '$lib/server/auth/guards';
import { getUnreadCount } from '$lib/server/db/notifications/queries';
import { consumeTransparencyMarker, hasSeenTransparency } from '$lib/server/db/preferences';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	const { user } = requireAuth(locals, url.pathname + url.search);
	depends('app:notifications');

	const onDataPage = url.pathname.includes('/account/data');

	// The transparency gate (a cheap PK read) and the unread-count nav badge are
	// independent — resolve them in one parallel wave instead of two serial
	// round-trips on every authenticated navigation.
	const [seenTransparency, unreadCount] = await Promise.all([hasSeenTransparency(user.id), getUnreadCount(user.id)]);

	// First sign-in: send the user once to the data-transparency page. The atomic
	// consume (one-shot, prefetch-safe) only runs while the marker is still unset.
	// Self-excludes the target path (the page consumes the marker on direct visit).
	if (!seenTransparency) {
		const firstTime = await consumeTransparencyMarker(user.id);
		if (firstTime && !onDataPage) {
			redirect(303, localizeHref('/account/data?welcome=1'));
		}
	}

	return { user, unreadCount };
};
