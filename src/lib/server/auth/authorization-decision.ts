/**
 * The user's answer on the authorization page, handed to Better Auth's consent endpoint.
 *
 * `oauth_query` is the signed authorization request exactly as the authorization server
 * redirected it to the page; the endpoint verifies its signature and expiry, binds it to this
 * session, and answers with where the browser goes next — the client's redirect URI with a
 * single-use code (or `error=access_denied`). Nothing about the request is trusted from the
 * form beyond that signed string, and the answer is only followed when it points at the
 * signed, registered callback (`callback-destination.ts`).
 */

import { registeredRedirectUris } from './application-authorizations.ts';
import { type CallbackDestination, classifyCallbackDestination } from './callback-destination.ts';
import { auth, siteUrl } from './index';

export async function submitAuthorizationDecision(
	headers: Headers,
	oauthQuery: string,
	accept: boolean,
): Promise<CallbackDestination> {
	// Throws an APIError on a bad signature, an expired request or a mismatched session.
	const result = await auth.api.oauth2Consent({ body: { accept, oauth_query: oauthQuery }, headers });
	const location =
		result && typeof result === 'object' && 'url' in result && typeof result.url === 'string' ? result.url : null;
	if (!location) return { kind: 'refused' };

	// The consent endpoint accepted the signature, so these parameters are the signed ones.
	const signed = new URLSearchParams(oauthQuery);
	const clientId = signed.get('client_id');
	return classifyCallbackDestination(location, {
		siteOrigin: siteUrl.origin,
		signedRedirectUri: signed.get('redirect_uri'),
		registeredRedirectUris: clientId ? await registeredRedirectUris(clientId) : [],
	});
}
