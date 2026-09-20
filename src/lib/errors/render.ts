/**
 * Resolve an error code to a localized human message.
 *
 * Used by adapters (form actions, +server.ts handlers, AI tool wrappers) to
 * turn the stable wire code into a Paraglide-rendered string in the request
 * locale. Pure domain code never calls this — it throws codes; adapters render.
 */

import * as m from '$lib/paraglide/messages';
import type { ErrorCode } from './codes';

const RESOLVERS: Record<ErrorCode, () => string> = {
	AUTH_INVALID: () => m.errors_auth_invalid(),
	VALIDATION_REQUIRED: () => m.errors_validation_required(),
	RESOURCE_NOT_FOUND: () => m.errors_resource_not_found(),
	RATE_LIMITED: () => m.errors_rate_limited(),
	INTERNAL: () => m.errors_internal(),
};

/** Return the localized message for an error code. Falls back to INTERNAL on unknown codes. */
export function errorMessage(code: ErrorCode | string): string {
	const resolver = RESOLVERS[code as ErrorCode];
	return resolver ? resolver() : m.errors_internal();
}

/**
 * Localize a Better Auth client error from the passwordless sign-in flows.
 *
 * The abuse gates in front of /api/auth/* answer in the auth dialect
 * (top-level `code`/`message`, plus `retryAfterSeconds` on rate limits) —
 * map the stable codes to localized copy instead of echoing the English
 * server string. Unknown errors fall through to the server message, then
 * to the caller's fallback.
 */
export function authErrorMessage(
	err: { status?: number; code?: string; message?: string } | null | undefined,
	fallback: () => string,
): string {
	if (!err) return fallback();
	if (err.status === 429 || err.code === 'rate_limited') {
		const retryAfterSeconds = (err as { retryAfterSeconds?: unknown }).retryAfterSeconds;
		// Only the per-email window is long enough to be worth a countdown; the
		// per-IP bucket resets within a minute and keeps the generic copy.
		if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 90) {
			return m.auth_login_error_rate_limited_minutes({ minutes: Math.ceil(retryAfterSeconds / 60) });
		}
		return m.auth_login_error_rate_limited();
	}
	if (err.code === 'captcha_required') return m.auth_login_error_captcha();
	return err.message ?? fallback();
}
