import { ServerError } from '$lib/server/errors';

/**
 * Why a call was refused before it was attempted.
 *
 * All three mean "the system chose not to try", which is deliberately distinct from
 * a dependency failing: the caller learns that its work never ran, so a retry is
 * pointless until the stated time and a fallback is the only useful response.
 */
export type ResilienceErrorKind = 'breaker_open' | 'bulkhead_full' | 'shed';

export class ResilienceError extends ServerError {
	constructor(
		public override readonly kind: ResilienceErrorKind,
		message: string,
		/** Seconds until it is worth asking again, when that is known. */
		public readonly retryAfterSeconds?: number,
	) {
		super(kind, message);
		this.name = 'ResilienceError';
	}

	/**
	 * 503 for all three: the service is temporarily declining work it could otherwise
	 * do. Not 500 — nothing is broken here — and not 429, which says the CALLER asked
	 * too often when the real cause is the system's own state.
	 */
	override toStatus(): number {
		return 503;
	}
}
