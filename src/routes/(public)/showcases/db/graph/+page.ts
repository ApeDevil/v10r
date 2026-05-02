import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';

export const load = () => {
	redirect(303, localizeHref('/showcases/db/graph/connection'));
};
