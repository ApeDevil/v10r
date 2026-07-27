import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { sanitizeInternalPath } from '$lib/server/security/safe-path';
import type { PageServerLoad } from './$types';

const DEFAULT_REDIRECT = '/account/dashboard';

function sanitizeReturnTo(raw: string | null): string {
	return sanitizeInternalPath(raw) ?? DEFAULT_REDIRECT;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		redirect(303, localizeHref(sanitizeReturnTo(url.searchParams.get('returnTo'))));
	}

	const email = url.searchParams.get('email');
	if (!email) {
		redirect(303, localizeHref('/auth/login'));
	}

	return {
		title: 'Verify Code',
		email,
		returnTo: sanitizeReturnTo(url.searchParams.get('returnTo')),
	};
};
