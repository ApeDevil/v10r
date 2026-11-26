/**
 * CSRF predicates — extracted from hooks.server.ts so they are unit-testable as
 * pure functions. The hook wires these together; the security logic lives here.
 *
 * Defense in depth on mutating API calls:
 *  1) Require an X-Requested-With header (blocks simple form POSTs / image-loaded GETs).
 *  2) Require the Origin (or Referer fallback) host to match this request's host.
 * Exempt prefixes carry their own auth (Better Auth, Bearer, HMAC, beacon).
 */

export const CSRF_EXEMPT_PREFIXES = [
	'/api/auth/', // Better Auth (own CSRF)
	'/api/cron/', // Vercel cron + Bearer token
	'/api/webhooks/', // Third-party webhooks (HMAC signature)
	'/api/analytics/journey', // navigator.sendBeacon (no custom headers possible)
	'/api/a2a', // A2A JSON-RPC: public, unauthenticated, read-only (no ambient cookie authority); agent clients can't send X-Requested-With
	// MCP over HTTP. No MCP endpoint reads the session cookie: admin/private take a static
	// Bearer, 3d takes an OAuth access token in the Authorization header (verifyResourceAccess),
	// public is unauthenticated read-only. With no ambient cookie authority a cross-site request
	// carries nothing to abuse, so CSRF is moot — and MCP clients cannot send X-Requested-With.
	// Keep it that way: never let an /api/mcp/* route fall back to locals.user.
	'/api/mcp/',
] as const;

/**
 * Does `path` fall under an exempt entry?
 *
 * Matched as "the entry itself, or anything below it" rather than as a raw
 * string prefix. `/api/analytics/journey` has no trailing slash — it must
 * exempt itself and `/api/analytics/journey/collect`, but a bare
 * `startsWith` would also have exempted a future `/api/analytics/journeys` or
 * `/api/analytics/journey-admin`. No such route exists today, which is what
 * made it a trap rather than a bug: the entry that silently widens is the one
 * added later, by someone who never reads this file.
 *
 * Entries written WITH a trailing slash keep their existing meaning exactly,
 * since the segment boundary is already part of the string.
 */
function isExempt(path: string): boolean {
	return CSRF_EXEMPT_PREFIXES.some(
		(prefix) =>
			path === prefix ||
			path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) ||
			// A trailing-slash entry should still exempt the bare collection path.
			(prefix.endsWith('/') && path === prefix.slice(0, -1)),
	);
}

/** True when a request must pass the CSRF check (mutating /api/* outside the exempt set). */
export function needsCsrf(method: string, path: string): boolean {
	const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
	return isMutating && path.startsWith('/api/') && !isExempt(path);
}

/** True when the URL in `headerValue` has the same host as `expectedHost`. */
export function isSameHost(headerValue: string | null, expectedHost: string): boolean {
	if (!headerValue) return false;
	try {
		return new URL(headerValue).host === expectedHost;
	} catch {
		return false;
	}
}

/**
 * Cross-site form submissions — the check SvelteKit itself makes, owned here instead.
 *
 * SvelteKit 3 refuses every mutating request whose body could be a plain HTML form
 * (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`, its binary form
 * type, or no content type) unless its `Origin` is this site. It runs before any hook, in
 * production only, and offers no per-route exception: only `csrf.trustedOrigins`, globally.
 *
 * OAuth 2.0 needs one: a client exchanges its code at the token endpoint server-to-server, as a
 * form POST with no `Origin` (RFC 6749 §4.1.3), and so do revocation (RFC 7009) and
 * introspection (RFC 7662). SvelteKit answered those with 403, so no MCP host could finish
 * connecting. So the framework check is switched off (`trustedOrigins: ['*']`, vite.config.ts)
 * and this predicate, wired first in the hook chain, applies the same rule to every route
 * except those three endpoints. They carry no ambient authority — a code is useless without its
 * PKCE verifier, a token without being the token — and Better Auth checks the origin of any
 * request that does carry its session cookie.
 */
export const OAUTH_SERVER_TO_SERVER_PATHS: ReadonlySet<string> = new Set([
	'/api/auth/oauth2/token',
	'/api/auth/oauth2/revoke',
	'/api/auth/oauth2/introspect',
]);

const FORM_CONTENT_TYPES = new Set([
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain',
	'application/x-sveltekit-formdata',
]);

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface FormSubmission {
	method: string;
	path: string;
	contentType: string | null;
	origin: string | null;
	/** This site's origin, as SvelteKit derives it (the request URL's). */
	selfOrigin: string;
}

/** True when SvelteKit's own rule would refuse this request, outside the OAuth exceptions. */
export function isCrossSiteFormSubmission(request: FormSubmission): boolean {
	const type = request.contentType?.split(';', 1)[0].trim().toLowerCase() ?? '';
	const formLike = !request.contentType || FORM_CONTENT_TYPES.has(type);
	return (
		formLike &&
		MUTATING_METHODS.has(request.method) &&
		request.origin !== request.selfOrigin &&
		!OAUTH_SERVER_TO_SERVER_PATHS.has(request.path)
	);
}
