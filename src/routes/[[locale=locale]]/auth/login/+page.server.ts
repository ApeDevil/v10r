import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { passkeysEnabled } from '$lib/server/auth';
import { sanitizeInternalPath } from '$lib/server/security/safe-path';
import type { PageServerLoad } from './$types';

const DEFAULT_REDIRECT = '/account/dashboard';

/** Validate returnTo is a safe relative path (no open redirect) */
function sanitizeReturnTo(raw: string | null): string {
	return sanitizeInternalPath(raw) ?? DEFAULT_REDIRECT;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));

	// Already logged in → redirect to returnTo or dashboard
	if (locals.user) {
		redirect(303, localizeHref(returnTo));
	}

	return {
		title: 'Log In',
		returnTo,
		passkeysEnabled,
		rateLimited: url.searchParams.get('error') === 'rate_limited',
	};
};
