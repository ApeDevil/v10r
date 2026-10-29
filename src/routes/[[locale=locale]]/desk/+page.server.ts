// The desk moved into the showcases. Old links and bookmarks — including the
// `?open=` / `?panel=` / `?post=` deep links — keep resolving via this 308.
import { redirect } from '@sveltejs/kit';
import { localizeHref } from '#lib/i18n/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	redirect(308, localizeHref('/showcases/desk') + url.search);
};
