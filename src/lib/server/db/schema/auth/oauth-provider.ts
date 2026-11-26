/**
 * BETTER AUTH oauth-provider + jwt plugin tables — Velociraptor as an OAuth authorization
 * server for external applications (MCP hosts) acting on behalf of a signed-in user.
 *
 * Generated with `bunx auth@1.7.28 generate` and moved into the `auth` namespace. Export names
 * must match the plugins' model ids and the field keys their adapter lookup keys; SQL names
 * follow snake_case. Do not edit column shapes — Better Auth expects these exactly.
 *
 * What these rows are, and are not:
 *  - `oauthClient` — an external application. CIMD clients (`clientDiscoveryId` set) are
 *    domain-bound: their `client_id` is an HTTPS URL the client controls. DCR clients are
 *    self-declared and shown as such.
 *  - `oauthConsent` — the user's authorization of one client for some scopes and resources.
 *    In the app's vocabulary this is an *application authorization*; `consent` on its own is
 *    GDPR's word (docs/naming.md). The table name is upstream's.
 *  - `oauthRefreshToken` / `oauthAccessToken` — hashed at rest (`storeTokens: "hashed"`).
 *    JWT access tokens (issued whenever a `resource` is requested) are not stored at all.
 *  - `jwks` — the signing keys; the private key is encrypted with BETTER_AUTH_SECRET.
 *
 * No row here holds model content: a model definition is never part of an authorization
 * request, a token or a client record (docs/blueprint/architecture/mcp-authorization.md).
 */
import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { authSchema, session, user } from './_better-auth';

export const jwks = authSchema.table('jwks', {
	id: text('id').primaryKey(),
	publicKey: text('public_key').notNull(),
	privateKey: text('private_key').notNull(),
	createdAt: timestamp('created_at').notNull(),
	expiresAt: timestamp('expires_at'),
	alg: text('alg'),
	crv: text('crv'),
});

export const oauthClient = authSchema.table(
	'oauth_client',
	{
		id: text('id').primaryKey(),
		clientId: text('client_id').notNull().unique(),
		clientSecret: text('client_secret'),
		clientDiscoveryId: text('client_discovery_id'),
		disabled: boolean('disabled').default(false),
		skipConsent: boolean('skip_consent'),
		enableEndSession: boolean('enable_end_session'),
		subjectType: text('subject_type'),
		scopes: text('scopes').array(),
		clientCredentialsScopes: text('client_credentials_scopes').array().default([]),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at'),
		name: text('name'),
		uri: text('uri'),
		icon: text('icon'),
		contacts: text('contacts').array(),
		tos: text('tos'),
		policy: text('policy'),
		softwareId: text('software_id'),
		softwareVersion: text('software_version'),
		softwareStatement: text('software_statement'),
		redirectUris: text('redirect_uris').array().notNull(),
		postLogoutRedirectUris: text('post_logout_redirect_uris').array(),
		backchannelLogoutUri: text('backchannel_logout_uri'),
		backchannelLogoutSessionRequired: boolean('backchannel_logout_session_required'),
		tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
		applicationType: text('application_type'),
		jwks: text('jwks'),
		jwksUri: text('jwks_uri'),
		grantTypes: text('grant_types').array(),
		responseTypes: text('response_types').array(),
		requirePKCE: boolean('require_pkce'),
		dpopBoundAccessTokens: boolean('dpop_bound_access_tokens').default(false),
		referenceId: text('reference_id'),
		metadata: jsonb('metadata'),
	},
	(table) => [index('auth_oauth_client_user_idx').on(table.userId)],
);

export const oauthResource = authSchema.table('oauth_resource', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull().unique(),
	name: text('name').notNull(),
	accessTokenTtl: integer('access_token_ttl'),
	refreshTokenTtl: integer('refresh_token_ttl'),
	signingAlgorithm: text('signing_algorithm'),
	signingKeyId: text('signing_key_id'),
	allowedScopes: text('allowed_scopes').array(),
	customClaims: jsonb('custom_claims'),
	dpopBoundAccessTokensRequired: boolean('dpop_bound_access_tokens_required').default(false),
	disabled: boolean('disabled').default(false),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at'),
	policyVersion: integer('policy_version').default(1),
	metadata: jsonb('metadata'),
});

export const oauthClientResource = authSchema.table(
	'oauth_client_resource',
	{
		id: text('id').primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		resourceId: text('resource_id')
			.notNull()
			.references(() => oauthResource.identifier, { onDelete: 'cascade' }),
		metadata: jsonb('metadata'),
		createdAt: timestamp('created_at'),
	},
	(table) => [
		uniqueIndex('auth_oauth_client_resource_uniq').on(table.clientId, table.resourceId),
		index('auth_oauth_client_resource_client_idx').on(table.clientId),
		index('auth_oauth_client_resource_resource_idx').on(table.resourceId),
	],
);

export const oauthRefreshToken = authSchema.table(
	'oauth_refresh_token',
	{
		id: text('id').primaryKey(),
		token: text('token').notNull().unique(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		referenceId: text('reference_id'),
		authorizationCodeId: text('authorization_code_id'),
		resources: text('resources').array(),
		requestedUserInfoClaims: text('requested_user_info_claims').array(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').notNull(),
		revoked: timestamp('revoked'),
		rotatedAt: timestamp('rotated_at'),
		rotationReplayResponse: text('rotation_replay_response'),
		rotationReplayExpiresAt: timestamp('rotation_replay_expires_at'),
		authTime: timestamp('auth_time'),
		confirmation: jsonb('confirmation'),
		scopes: text('scopes').array().notNull(),
	},
	(table) => [
		index('auth_oauth_refresh_token_client_idx').on(table.clientId),
		index('auth_oauth_refresh_token_session_idx').on(table.sessionId),
		index('auth_oauth_refresh_token_user_idx').on(table.userId),
		index('auth_oauth_refresh_token_code_idx').on(table.authorizationCodeId),
	],
);

export const oauthAccessToken = authSchema.table(
	'oauth_access_token',
	{
		id: text('id').primaryKey(),
		token: text('token').notNull().unique(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		referenceId: text('reference_id'),
		authorizationCodeId: text('authorization_code_id'),
		resources: text('resources').array(),
		requestedUserInfoClaims: text('requested_user_info_claims').array(),
		refreshId: text('refresh_id').references(() => oauthRefreshToken.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').notNull(),
		revoked: timestamp('revoked'),
		confirmation: jsonb('confirmation'),
		scopes: text('scopes').array().notNull(),
	},
	(table) => [
		index('auth_oauth_access_token_client_idx').on(table.clientId),
		index('auth_oauth_access_token_session_idx').on(table.sessionId),
		index('auth_oauth_access_token_user_idx').on(table.userId),
		index('auth_oauth_access_token_code_idx').on(table.authorizationCodeId),
		index('auth_oauth_access_token_refresh_idx').on(table.refreshId),
	],
);

export const oauthConsent = authSchema.table(
	'oauth_consent',
	{
		id: text('id').primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		referenceId: text('reference_id'),
		resources: text('resources').array(),
		requestedUserInfoClaims: text('requested_user_info_claims').array(),
		scopes: text('scopes').array().notNull(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
	},
	(table) => [
		index('auth_oauth_consent_client_idx').on(table.clientId),
		index('auth_oauth_consent_user_idx').on(table.userId),
	],
);

/** Single-use ledger for `private_key_jwt` client assertions (replay prevention). */
export const oauthClientAssertion = authSchema.table('oauth_client_assertion', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
});
