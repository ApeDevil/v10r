/**
 * Resuming an OAuth authorization request across sign-in.
 *
 * When an external application sends a signed-out user to `/api/auth/oauth2/authorize`, the
 * authorization server redirects to the login page with the original request plus a signature
 * (`sig`, `exp`, `ba_*`). Sign-in here has five paths — magic link (opened from the inbox, often
 * in another tab), email code, GitHub, Google, passkey — and every one of them already honours
 * `returnTo`. So the transaction is carried as one: the original authorization request becomes
 * the `returnTo`, and after any sign-in the browser re-enters the authorization endpoint with
 * it. Nothing is trusted from the signature-stripped copy: the endpoint re-validates the client,
 * redirect URI, PKCE challenge, scope and resource from scratch, now with a session.
 *
 * Pure.
 */
import { AUTHORIZATION_ENDPOINT_PATH } from '#lib/utils/safe-path.ts';

/** Parameters the authorization server adds to sign its redirect; not part of the request. */
const SIGNATURE_PARAMS = new Set(['sig', 'exp', 'ba_iat', 'ba_pl', 'ba_param']);

/** The authorization request to resume, or null when this is an ordinary login. */
export function authorizationResumePath(params: URLSearchParams): string | null {
	if (!params.has('sig') || !params.get('client_id') || params.get('response_type') !== 'code') return null;
	const request = new URLSearchParams();
	for (const [key, value] of params) {
		if (!SIGNATURE_PARAMS.has(key) && key !== 'returnTo') request.append(key, value);
	}
	return `${AUTHORIZATION_ENDPOINT_PATH}?${request.toString()}`;
}
