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
	'/api/mcp/', // MCP over HTTP: no ambient cookie auth (admin=Bearer, public=unauth read-only), so CSRF is moot; non-browser clients can't send X-Requested-With
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
