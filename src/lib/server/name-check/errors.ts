import { ServerError } from '$lib/server/errors';

/**
 * Why a source produced no answer. Each kind maps to exactly one coverage status in
 * `check.ts`, so a new failure mode has to choose its status here, once.
 */
export type NameSourceErrorKind = 'unavailable' | 'quota_exhausted' | 'credentials_missing' | 'rate_limited';

export class NameSourceError extends ServerError {
	constructor(
		public override readonly kind: NameSourceErrorKind,
		message: string,
		/** From the upstream's `Retry-After`, when it sent one. */
		public readonly retryAfterSeconds?: number,
	) {
		super(kind, message);
		this.name = 'NameSourceError';
	}

	/** Never surfaces as an HTTP status: a failed source is coverage, not an error response. */
	override toStatus(): number {
		return 503;
	}
}
