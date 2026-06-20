import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import type { PageServerLoad } from './$types';

/** Bare /admin/db lands on the Observe tab. Auth handled by +layout.server.ts. */
export const load: PageServerLoad = () => {
	redirect(307, localizeHref('/admin/db/observe'));
};
