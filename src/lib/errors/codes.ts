/**
 * Client-side error codes with a localized rendering (`./render.ts`).
 *
 * These are NOT the REST wire codes — adapters emit snake_case codes through
 * `$lib/server/http/response.ts` (`not_found`, `rate_limited`, …). This set is what the
 * login page and the i18n showcase resolve to copy; add a code only with a consumer.
 */

export const ErrorCode = {
	AUTH_INVALID: 'AUTH_INVALID',
	VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
	RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
	RATE_LIMITED: 'RATE_LIMITED',
	INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
