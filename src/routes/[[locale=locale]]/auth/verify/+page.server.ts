import { redirect } from '@sveltejs/kit';
import { localizeHref } from '#lib/i18n/index.ts';
import { isAuthorizationResumePath, sanitizeInternalPath } from '#lib/utils/safe-path.ts';
import type { PageServerLoad } from './$types';

const DEFAULT_REDIRECT = '/account/dashboard';

function sanitizeReturnTo(raw: string | null): string {
	return sanitizeInternalPath(raw) ?? DEFAULT_REDIRECT;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
		redirect(303, isAuthorizationResumePath(returnTo) ? returnTo : localizeHref(returnTo));
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
