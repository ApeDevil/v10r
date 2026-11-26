/**
 * RESOURCE ACCESS — the gate in front of a protected MCP service (an OAuth resource server).
 *
 * The order is the security property: nothing here, and nothing behind it, runs before the
 * caller is proven. For every request:
 *
 *  1. No `Authorization` header → 401 with the RFC 9728 challenge (`resource_metadata`,
 *     `scope`), which is what makes a host discover the authorization server and start the
 *     OAuth flow. Never a redirect to an HTML login page.
 *  2. The access token is verified by Better Auth's own resource-server verifier
 *     (`verifyAccessTokenRequest`): signature against the in-process JWKS, issuer, audience
 *     = this service's resource identifier, expiry, and the service's scope. A token minted
 *     for another service fails the audience check; a token without the scope gets 403
 *     `insufficient_scope`. Challenges come from `createResourceServerChallenge`, so the
 *     header grammar is upstream's, not ours.
 *  3. Liveness (`checkApplicationAuthorization`): the account exists and is not banned, and
 *     the user's authorization of this client still grants the scope. A revoked
 *     authorization or a suspended account is refused on the next request, not at `exp`.
 *
 * Any failure to complete a check (database down, keys unreadable) refuses with 503: there
 * is no unauthenticated fallback. Session cookies are never consulted — the protected
 * endpoint has no ambient browser authority, which is why its CSRF exemption stays sound.
 *
 * Never logs or returns the token.
 */

import { requestToResourceInput, verifyAccessTokenRequest } from '@better-auth/core/oauth2';
import { createResourceServerChallenge } from '@better-auth/oauth-provider';
import { APIError, isAPIError } from 'better-auth/api';
import { type AuthorizationLiveness, checkApplicationAuthorization } from './application-authorizations';
import { auth, siteUrl } from './index';
import { type ProtectedMcpService, resourceIdentifier } from './protected-mcp-services';

export interface ResourceCaller {
	userId: string;
	/** The OAuth client acting for the user. */
	clientId: string;
	scopes: string[];
}

export type ResourceAccess = { ok: true; caller: ResourceCaller } | { ok: false; response: Response };

/** The authorization server's issuer: Better Auth's base URL including its `/api/auth` path. */
export const OAUTH_ISSUER = `${siteUrl.origin}/api/auth`;

/** One cache identity for the in-process key set: the verifier keeps its TTL and kid-miss refetch rules. */
const JWKS_CACHE_KEY = {};

function refusal(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
	});
}

function fromApiError(error: unknown): Response | null {
	if (!isAPIError(error)) return null;
	const headers = Object.fromEntries(new Headers(error.headers ?? {}).entries());
	return refusal(error.statusCode, error.body ?? { error: 'invalid_token' }, headers);
}

/** 401 with the bearer challenge: no token, or a token that is no longer honoured. */
function challenge(service: ProtectedMcpService, request: Request, error?: string, description?: string): Response {
	const resource = resourceIdentifier(service, siteUrl.origin);
	const unauthorized = new APIError(
		'UNAUTHORIZED',
		error ? { error, error_description: description } : { message: 'authorization required' },
	);
	const shaped = createResourceServerChallenge(unauthorized, resource, { challengeScopes: [service.scope], request });
	return fromApiError(shaped) ?? refusal(401, { error: 'invalid_token' });
}

const LIVENESS_REFUSAL: Record<Exclude<AuthorizationLiveness, 'live'>, string> = {
	revoked: 'The authorization for this application was revoked. Connect it again to continue.',
	'account-unavailable': 'This account cannot use the service.',
};

export async function verifyResourceAccess(request: Request, service: ProtectedMcpService): Promise<ResourceAccess> {
	if (!request.headers.get('authorization')) return { ok: false, response: challenge(service, request) };

	const resource = resourceIdentifier(service, siteUrl.origin);
	let payload: Awaited<ReturnType<typeof verifyAccessTokenRequest>>;
	try {
		payload = await verifyAccessTokenRequest(requestToResourceInput(request), {
			verifyOptions: { audience: resource, issuer: OAUTH_ISSUER },
			requiredScopes: [service.scope],
			jwksFetch: () => auth.api.getJwks(),
			jwksCacheKey: JWKS_CACHE_KEY,
		});
	} catch (error) {
		if (isAPIError(error)) {
			const shaped = createResourceServerChallenge(error, resource, { challengeScopes: [service.scope], request });
			const response = fromApiError(shaped ?? error);
			if (response) return { ok: false, response };
		}
		// Not a verdict on the token — the verifier itself could not run. Fail closed.
		return { ok: false, response: refusal(503, { error: 'temporarily_unavailable' }, { 'Retry-After': '5' }) };
	}

	const userId = typeof payload.sub === 'string' ? payload.sub : null;
	const clientId = typeof payload.azp === 'string' ? payload.azp : null;
	// A user-delegated token always has both; client_credentials is not enabled here.
	if (!userId || !clientId || userId === clientId) {
		return { ok: false, response: challenge(service, request, 'invalid_token', 'not a user-delegated token') };
	}

	let liveness: AuthorizationLiveness;
	try {
		liveness = await checkApplicationAuthorization({ userId, clientId, scope: service.scope });
	} catch {
		return { ok: false, response: refusal(503, { error: 'temporarily_unavailable' }, { 'Retry-After': '5' }) };
	}
	if (liveness !== 'live') {
		return { ok: false, response: challenge(service, request, 'invalid_token', LIVENESS_REFUSAL[liveness]) };
	}

	const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [];
	return { ok: true, caller: { userId, clientId, scopes } };
}

/**
 * RFC 9728 Protected Resource Metadata for one service — what a host reads (from the 401's
 * `resource_metadata`, or the path-inserted well-known URL) to find the authorization server.
 * `resource` equals the URL a user pastes into the host, exactly: Claude compares the two.
 * No `offline_access` here: a resource challenges for its own scope only (MCP 2026-07-28);
 * the authorization server advertises refresh separately.
 */
export function protectedResourceMetadata(service: ProtectedMcpService) {
	return {
		resource: resourceIdentifier(service, siteUrl.origin),
		resource_name: `Velociraptor ${service.name}`,
		authorization_servers: [OAUTH_ISSUER],
		scopes_supported: [service.scope],
		bearer_methods_supported: ['header'],
		resource_documentation: `${siteUrl.origin}/docs/blueprint/architecture/mcp-authorization`,
	};
}
