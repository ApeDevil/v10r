/**
 * PROTECTED MCP SERVICES — the authorization contract between Velociraptor's OAuth
 * authorization server (Better Auth `oauth-provider`) and the specialized MCP services it
 * protects.
 *
 * One entry per service. Each service is its own OAuth protected resource (RFC 9728):
 *  - `path`     — where it is served; with the canonical site origin it is the resource
 *                 identifier (RFC 8707 `resource`, the token's `aud`).
 *  - `scope`    — the one scope that admits a caller. Every tool of a stateless service has
 *                 the same authorization requirement, so per-tool scopes would add consent
 *                 noise without separating anything.
 *
 * Separation is by audience AND scope: a token minted for MCP 3D carries
 * `aud = <origin>/api/mcp/3d` and `scope = mcp:3d:use`, and a future service verifies its own
 * audience — so one service's token never opens another, even if a client was granted both.
 * The Pattern MCP (`/api/mcp/public|private|admin`) is NOT here: its surfaces keep their own
 * access policies (public read-only; machine bearer secrets), and no OAuth token opens them.
 *
 * Pure: no framework, no database, no Better Auth instance (`auth/index.ts` imports this).
 */

export type ProtectedMcpServiceId = '3d';

export interface ProtectedMcpService {
	id: ProtectedMcpServiceId;
	/** Display name on the authorization page and the connected-applications list. */
	name: string;
	/** Path of the MCP endpoint on the canonical origin. No trailing slash. */
	path: `/api/mcp/${string}`;
	/** The single scope this service requires. Shape: `mcp:<service>:<verb>`. */
	scope: `mcp:${string}:${string}`;
}

export const MCP_3D_SERVICE = {
	id: '3d',
	name: 'MCP 3D',
	path: '/api/mcp/3d',
	scope: 'mcp:3d:use',
} as const satisfies ProtectedMcpService;

export const PROTECTED_MCP_SERVICES: readonly ProtectedMcpService[] = [MCP_3D_SERVICE];

/**
 * Lets a client keep its authorization across access-token expiry (a refresh token). The
 * authorization server advertises it; the MCP services never challenge for it (MCP
 * 2026-07-28: servers SHOULD NOT put `offline_access` in a challenge).
 */
export const OFFLINE_ACCESS_SCOPE = 'offline_access';

/** Every scope the authorization server knows. Deliberately no `openid`, `profile`, `email`. */
export const OAUTH_SCOPES = [...PROTECTED_MCP_SERVICES.map((service) => service.scope), OFFLINE_ACCESS_SCOPE];

/** The RFC 8707 resource identifier: canonical origin + path, never a request's `Host`. */
export function resourceIdentifier(service: ProtectedMcpService, origin: string): string {
	return `${new URL(origin).origin}${service.path}`;
}

/** RFC 9728 §3.1: the metadata URL inserts the well-known segment before the resource path. */
export function protectedResourceMetadataUrl(service: ProtectedMcpService, origin: string): string {
	return `${new URL(origin).origin}/.well-known/oauth-protected-resource${service.path}`;
}

/** The service an audience names, for labelling an authorization's resources. */
export function serviceForResource(resource: string, origin: string): ProtectedMcpService | undefined {
	return PROTECTED_MCP_SERVICES.find((service) => resourceIdentifier(service, origin) === resource);
}

/** Lifetimes (seconds). Access tokens are short; the per-request liveness check is what revokes. */
export const MCP_ACCESS_TOKEN_TTL = 15 * 60;
export const MCP_REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;
