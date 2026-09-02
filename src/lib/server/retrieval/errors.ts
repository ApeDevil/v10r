import { ServerError } from '$lib/server/errors';

export type RetrievalErrorKind =
	| 'embedding'
	| 'storage'
	| 'graph'
	| 'ingestion'
	| 'not_found'
	| 'limit_exceeded'
	| 'timeout'
	| 'unknown';

export class RetrievalError extends ServerError {
	constructor(
		public readonly kind: RetrievalErrorKind,
		message: string,
		options?: { cause?: unknown },
	) {
		super(kind, message);
		this.name = 'RetrievalError';
		if (options?.cause !== undefined) {
			(this as { cause?: unknown }).cause = options.cause;
		}
	}

	override toStatus(): number {
		return retrievalErrorToStatus(this.kind);
	}
}

/** Map RetrievalErrorKind to HTTP status code */
export function retrievalErrorToStatus(kind: RetrievalErrorKind): number {
	switch (kind) {
		case 'embedding':
			return 502;
		case 'storage':
			return 500;
		case 'graph':
			return 502;
		case 'ingestion':
			return 422;
		case 'not_found':
			return 404;
		case 'limit_exceeded':
			return 403;
		case 'timeout':
			return 504;
		default:
			return 500;
	}
}
