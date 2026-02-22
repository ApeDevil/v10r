export type RetrievalErrorKind =
	| 'embedding'
	| 'storage'
	| 'graph'
	| 'ingestion'
	| 'not_found'
	| 'limit_exceeded'
	| 'timeout'
	| 'unknown';

export class RetrievalError extends Error {
	constructor(
		public readonly kind: RetrievalErrorKind,
		message: string,
	) {
		super(message);
		this.name = 'RetrievalError';
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
