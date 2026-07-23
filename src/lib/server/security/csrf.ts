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

/** True when a request must pass the CSRF check (mutating /api/* outside the exempt set). */
export function needsCsrf(method: string, path: string): boolean {
	const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
	return isMutating && path.startsWith('/api/') && !CSRF_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
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
