import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import type { PageServerLoad } from './$types';

/**
 * Bare /admin/analytics lands on the Human tab. Auth handled by
 * +layout.server.ts + each child load. `url.search` is carried along so old
 * `?range=90` bookmarks keep their range.
 */
export const load: PageServerLoad = ({ url }) => {
	redirect(307, localizeHref('/admin/analytics/human') + url.search);
};
