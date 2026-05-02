/**
 * Error code registry — single source of truth for stable wire codes.
 *
 * Domain code throws `DomainError` with a code; adapters surface
 * `{ code, message, fields? }` where `message` is Paraglide-resolved.
 * Renaming a code is a breaking change for non-browser clients.
 */

export const ErrorCode = {
	// auth — 401/403
	AUTH_REQUIRED: 'AUTH_REQUIRED',
	AUTH_INVALID: 'AUTH_INVALID',
	AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
	AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
	// validation — 400/422
	VALIDATION_FAILED: 'VALIDATION_FAILED',
	VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
	VALIDATION_FORMAT: 'VALIDATION_FORMAT',
	VALIDATION_LENGTH: 'VALIDATION_LENGTH',
	// resource — 404/409/410/423
	RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
	RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
	RESOURCE_GONE: 'RESOURCE_GONE',
	RESOURCE_LOCKED: 'RESOURCE_LOCKED',
	// i18n
	LOCALE_UNSUPPORTED: 'LOCALE_UNSUPPORTED',
	TRANSLATION_MISSING: 'TRANSLATION_MISSING',
	// rate limit — 429
	RATE_LIMITED: 'RATE_LIMITED',
	// idempotency — 409/422
	IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
	// upstream — 502/503/504
	UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
	UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
	// internal — 500
	INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Domain-layer error. Carries a stable code and optional per-field codes for
 * form validation. Pure — does not import from `$lib/paraglide/*`. Adapters
 * catch and resolve via `errorMessage(code)` from `./render`.
 */
export class DomainError extends Error {
	readonly code: ErrorCode;
	readonly fields?: Record<string, ErrorCode[]>;
	readonly meta?: Record<string, unknown>;

	constructor(code: ErrorCode, fields?: Record<string, ErrorCode[]>, meta?: Record<string, unknown>) {
		super(code);
		this.name = 'DomainError';
		this.code = code;
		this.fields = fields;
		this.meta = meta;
	}
}

export function isDomainError(value: unknown): value is DomainError {
	return value instanceof DomainError;
}
