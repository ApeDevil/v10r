/**
 * Base error class for all server-side domain errors.
 *
 * Every domain module (AI, Auth, Cache, Graph, Retrieval, Store) extends this
 * with its own `kind` discriminant. Provides a uniform interface for:
 * - HTTP status mapping via `toStatus()`
 * - Structured logging via `toJSON()`
 * - Type narrowing via `instanceof ServerError`
 */
export class ServerError extends Error {
	constructor(
		public readonly kind: string,
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = 'ServerError';
	}

	/** Map this error to an HTTP status code. Override in subclasses. */
	toStatus(): number {
		return 500;
	}

	/** Structured representation for logging / JSON responses. */
	toJSON() {
		return {
			name: this.name,
			kind: this.kind,
			message: this.message,
			code: this.code,
			status: this.toStatus(),
		};
	}
}
