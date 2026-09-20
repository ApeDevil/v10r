import { ServerError } from '$lib/server/errors';

/** The two failures the pipeline raises: the embedding provider, and an ingest that cannot proceed. */
export type RetrievalErrorKind = 'embedding' | 'ingestion';

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
		case 'ingestion':
			return 422;
	}
}
