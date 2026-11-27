/**
 * Which per-IP limiter an `/api/auth/*` request draws from.
 *
 * The strict `auth` limit (RATE_LIMIT_MAX) exists for the endpoints where volume is the attack:
 * checking a passkey assertion, a code or a link, and sending email. Every other auth request
 * used to draw from it too, so the steps AROUND one sign-in ate the budget of the sign-in
 * itself. Production, 2026-11-27: an MCP host's authorization link opened three times (the
 * host retries, and the browser re-enters it after sign-in), the login page fetched two passkey
 * challenges (autofill on load, then the button) — five requests, so the one passkey
 * verification that followed was refused with 429 on a first attempt.
 *
 * So the steps that only start or resume a sign-in get their own, wider bucket:
 *  - `sign-in-ceremony`: they check no secret and send nothing; each issues a fresh challenge
 *    or a redirect, and the authorization server re-validates the request on every entry.
 *  - `oauth-machine` and `oauth-callback` keep their existing reasons (shared host egress;
 *    one-time state on callbacks).
 *  - Everything else stays on the strict `auth` bucket. Unknown paths default there, so a new
 *    credential endpoint is limited strictly until someone decides otherwise.
 *
 * Pure.
 */

export type AuthRateLimitBucket = 'oauth-machine' | 'oauth-callback' | 'sign-in-ceremony' | 'auth';

/** OAuth authorization-server endpoints MCP hosts call server-to-server. */
const OAUTH_MACHINE_PATHS = new Set([
	'/api/auth/oauth2/token',
	'/api/auth/oauth2/register',
	'/api/auth/oauth2/revoke',
	'/api/auth/jwks',
]);

/** Steps that start or resume a sign-in without checking a secret or sending an email. */
const SIGN_IN_CEREMONY_PATHS = new Set([
	'/api/auth/oauth2/authorize',
	'/api/auth/passkey/generate-authenticate-options',
]);

export function authRateLimitBucket(path: string): AuthRateLimitBucket {
	if (OAUTH_MACHINE_PATHS.has(path)) return 'oauth-machine';
	if (path.startsWith('/api/auth/callback/')) return 'oauth-callback';
	if (SIGN_IN_CEREMONY_PATHS.has(path)) return 'sign-in-ceremony';
	return 'auth';
}
