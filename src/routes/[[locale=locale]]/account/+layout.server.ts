import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { consumeTransparencyMarker, hasSeenTransparency } from '$lib/server/db/preferences';
import { requireAuth } from '$lib/server/http/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { user } = requireAuth(locals, url.pathname + url.search);
	const onDataPage = url.pathname.includes('/account/data');

	const seenTransparency = await hasSeenTransparency(user.id);

	// First sign-in: send the user once to the data-transparency page. The atomic
	// consume (one-shot, prefetch-safe) only runs while the marker is still unset.
	// Self-excludes the target path (the page consumes the marker on direct visit).
	if (!seenTransparency) {
		const firstTime = await consumeTransparencyMarker(user.id);
		if (firstTime && !onDataPage) {
			redirect(303, localizeHref('/account/data?welcome=1'));
		}
	}

	return { user };
};
