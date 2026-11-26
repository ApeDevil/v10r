/**
 * Where the browser goes once sign-in succeeded. Ordinary destinations are localized pages
 * reached by client navigation; an OAuth authorization request being resumed
 * (`isAuthorizationResumePath`) is a server endpoint that answers with a redirect — to the
 * authorization page or straight back to the external application — so it needs a full
 * navigation, unlocalized.
 */
import { localizeHref } from '#lib/i18n/index.ts';
import { isAuthorizationResumePath } from '#lib/utils/safe-path.ts';
import { goto } from '$app/navigation';

export function continueAfterSignIn(returnTo: string): void {
	if (isAuthorizationResumePath(returnTo)) {
		window.location.assign(returnTo);
		return;
	}
	void goto(localizeHref(returnTo));
}
