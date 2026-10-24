import { redirect } from '@sveltejs/kit';
import { localizeHref } from '#lib/i18n/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	redirect(303, localizeHref('/admin/ai/overview'));
};
