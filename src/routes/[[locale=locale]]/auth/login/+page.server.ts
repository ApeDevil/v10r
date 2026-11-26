import { redirect } from '@sveltejs/kit';
import { localizeHref } from '#lib/i18n/index.ts';
import { authorizationResumePath } from '#lib/server/auth/authorization-request.ts';
import { passkeysEnabled } from '#lib/server/auth/index.ts';
import { isAuthorizationResumePath, sanitizeInternalPath } from '#lib/utils/safe-path.ts';
import type { PageServerLoad } from './$types';

const DEFAULT_REDIRECT = '/account/dashboard';

/** Validate returnTo is a safe relative path (no open redirect) */
function sanitizeReturnTo(raw: string | null): string {
	return sanitizeInternalPath(raw) ?? DEFAULT_REDIRECT;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// An external application's authorization request, redirected here for sign-in: carry it as
	// the returnTo (every sign-in method honours that) on a clean URL — see authorization-request.ts.
	const resume = authorizationResumePath(url.searchParams);
	if (resume) {
		redirect(303, locals.user ? resume : `${localizeHref('/auth/login')}?returnTo=${encodeURIComponent(resume)}`);
	}

	const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));

	// Already logged in → redirect to returnTo or dashboard
	if (locals.user) {
		redirect(303, isAuthorizationResumePath(returnTo) ? returnTo : localizeHref(returnTo));
	}

	return {
		title: 'Log In',
		returnTo,
		passkeysEnabled,
		rateLimited: url.searchParams.get('error') === 'rate_limited',
		authorizing: isAuthorizationResumePath(returnTo),
	};
};
