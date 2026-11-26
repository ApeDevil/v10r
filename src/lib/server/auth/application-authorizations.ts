/**
 * APPLICATION AUTHORIZATIONS — a user's permission for one external application (an OAuth
 * client, e.g. an MCP host) to call Velociraptor's protected services on their behalf.
 *
 * Better Auth's `oauth-provider` stores the permission as an `oauthConsent` row and the
 * credentials as `oauthRefreshToken` rows; access tokens for a protected service are JWTs and
 * are not stored. This module owns the three things the plugin does not:
 *
 *  1. **Liveness** (`checkApplicationAuthorization`): a JWT stays cryptographically valid until
 *     `exp`, so revocation and suspension would wait up to `MCP_ACCESS_TOKEN_TTL`. Every
 *     protected call therefore also asks the database, in one indexed query, whether the
 *     account still exists and is not banned AND the authorization for this client still
 *     grants the scope. Revocation takes effect on the next request.
 *  2. **Revocation** (`revokeApplicationAuthorization`): upstream `delete-consent` removes the
 *     consent row only, leaving refresh tokens able to mint new access tokens. Here the
 *     consent, the refresh tokens and any stored access tokens of that (user, client) go in
 *     one transaction.
 *  3. **The list a user reviews** (`listApplicationAuthorizations`): what each application
 *     can reach, projected for display. Token values never leave this module (they are
 *     hashed at rest anyway); nothing a model sent is part of any of these rows.
 *
 * Account deletion needs no code here: every table above references `auth.user` with
 * `ON DELETE CASCADE`.
 */
import { and, arrayContains, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema/auth/_better-auth.ts';
import {
	oauthAccessToken,
	oauthClient,
	oauthConsent,
	oauthRefreshToken,
} from '#lib/server/db/schema/auth/oauth-provider.ts';
import { type ApplicationIdentity, describeApplicationIdentity } from './application-identity';

export type AuthorizationLiveness = 'live' | 'revoked' | 'account-unavailable';

export interface LivenessQuery {
	userId: string;
	clientId: string;
	/** The scope the protected service requires. */
	scope: string;
}

/**
 * One round trip: the user row (must exist, must not be banned) left-joined to an
 * authorization of this client that still contains the scope.
 */
export async function checkApplicationAuthorization(query: LivenessQuery): Promise<AuthorizationLiveness> {
	const [row] = await db
		.select({ banned: user.banned, consentId: oauthConsent.id })
		.from(user)
		.leftJoin(
			oauthConsent,
			and(
				eq(oauthConsent.userId, user.id),
				eq(oauthConsent.clientId, query.clientId),
				arrayContains(oauthConsent.scopes, [query.scope]),
			),
		)
		.where(eq(user.id, query.userId))
		.limit(1);
	if (!row || row.banned) return 'account-unavailable';
	return row.consentId ? 'live' : 'revoked';
}

export interface ApplicationAuthorizationView {
	/** The authorization's id — what the revoke action names. */
	id: string;
	identity: ApplicationIdentity;
	scopes: string[];
	/** RFC 8707 resource identifiers the authorization covers (null: any allowed resource). */
	resources: string[] | null;
	authorizedAt: Date;
	updatedAt: Date;
	/** Most recent refresh-token issuance for this client, if any: when it last renewed access. */
	lastRenewedAt: Date | null;
}

export async function listApplicationAuthorizations(userId: string): Promise<ApplicationAuthorizationView[]> {
	const rows = await db
		.select({
			id: oauthConsent.id,
			clientId: oauthConsent.clientId,
			scopes: oauthConsent.scopes,
			resources: oauthConsent.resources,
			authorizedAt: oauthConsent.createdAt,
			updatedAt: oauthConsent.updatedAt,
			clientName: oauthClient.name,
			clientUri: oauthClient.uri,
			clientDiscoveryId: oauthClient.clientDiscoveryId,
			lastRenewedAt: sql<Date | null>`(
				select max(${oauthRefreshToken.createdAt}) from ${oauthRefreshToken}
				where ${oauthRefreshToken.userId} = ${oauthConsent.userId}
				and ${oauthRefreshToken.clientId} = ${oauthConsent.clientId}
			)`.mapWith((value: string | Date | null) => (value ? new Date(value) : null)),
		})
		.from(oauthConsent)
		.innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
		.where(eq(oauthConsent.userId, userId))
		.orderBy(oauthConsent.createdAt);

	return rows.map((row) => ({
		id: row.id,
		identity: describeApplicationIdentity({
			clientId: row.clientId,
			name: row.clientName,
			uri: row.clientUri,
			clientDiscoveryId: row.clientDiscoveryId,
		}),
		scopes: row.scopes,
		resources: row.resources,
		authorizedAt: row.authorizedAt,
		updatedAt: row.updatedAt,
		lastRenewedAt: row.lastRenewedAt,
	}));
}

/**
 * Revoke one authorization and every credential that rides on it. Returns false when the
 * authorization is not the user's (or no longer exists), so a forged id revokes nothing.
 */
export async function revokeApplicationAuthorization(userId: string, authorizationId: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [removed] = await tx
			.delete(oauthConsent)
			.where(and(eq(oauthConsent.id, authorizationId), eq(oauthConsent.userId, userId)))
			.returning({ clientId: oauthConsent.clientId });
		if (!removed) return false;
		await tx
			.delete(oauthAccessToken)
			.where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, removed.clientId)));
		await tx
			.delete(oauthRefreshToken)
			.where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, removed.clientId)));
		return true;
	});
}

export interface AuthorizationRequestView {
	identity: ApplicationIdentity;
	/** Host the browser returns to after the decision — the client's registered redirect URI. */
	redirectHost: string | null;
	/** Loopback redirect: a local program on this device (Claude Code, an inspector). */
	redirectsToThisDevice: boolean;
}

/**
 * What the authorization page shows about the application asking. Null when the client is
 * unknown or disabled — the authorization endpoint resolved it moments ago, so that means the
 * request was tampered with or the client was removed in between.
 */
export async function describeAuthorizationRequest(
	clientId: string,
	redirectUri: string | null,
): Promise<AuthorizationRequestView | null> {
	const [client] = await db
		.select({
			clientId: oauthClient.clientId,
			name: oauthClient.name,
			uri: oauthClient.uri,
			clientDiscoveryId: oauthClient.clientDiscoveryId,
			redirectUris: oauthClient.redirectUris,
			disabled: oauthClient.disabled,
		})
		.from(oauthClient)
		.where(eq(oauthClient.clientId, clientId))
		.limit(1);
	if (!client || client.disabled) return null;
	// Shown only when it is one of the client's registered URIs; the endpoint enforces the match.
	const registered = redirectUri && client.redirectUris.includes(redirectUri) ? new URL(redirectUri) : null;
	const loopback = registered ? ['localhost', '127.0.0.1', '[::1]'].includes(registered.hostname) : false;
	return {
		identity: describeApplicationIdentity(client),
		redirectHost: registered ? registered.host : null,
		redirectsToThisDevice: loopback,
	};
}
