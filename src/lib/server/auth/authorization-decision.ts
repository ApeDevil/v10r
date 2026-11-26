/**
 * The user's answer on the authorization page, handed to Better Auth's consent endpoint.
 *
 * `oauth_query` is the signed authorization request exactly as the authorization server
 * redirected it to the page; the endpoint verifies its signature and expiry, binds it to this
 * session, and answers with where the browser goes next — the client's redirect URI with a
 * single-use code (or `error=access_denied`). Nothing about the request is trusted from the
 * form beyond that signed string.
 */
import { auth } from './index';

export async function submitAuthorizationDecision(
	headers: Headers,
	oauthQuery: string,
	accept: boolean,
): Promise<string | null> {
	const result = await auth.api.oauth2Consent({ body: { accept, oauth_query: oauthQuery }, headers });
	return result && typeof result === 'object' && 'url' in result && typeof result.url === 'string' ? result.url : null;
}
