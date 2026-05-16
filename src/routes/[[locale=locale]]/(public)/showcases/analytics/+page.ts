import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';

export const prerender = false;

export const load = () => {
	redirect(303, localizeHref('/showcases/analytics/overview'));
};
