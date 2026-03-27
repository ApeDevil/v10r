import { ServerError } from '$lib/server/errors';

export type Neo4jErrorKind =
	| 'authentication'
	| 'http'
	| 'syntax'
	| 'constraint'
	| 'unavailable'
	| 'timeout'
	| 'unknown';

export class Neo4jError extends ServerError {
	constructor(
		public readonly kind: Neo4jErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(kind, message, code);
		this.name = 'Neo4jError';
	}

	override toStatus(): number {
		switch (this.kind) {
			case 'authentication':
				return 502;
			case 'http':
				return 502;
			case 'syntax':
				return 400;
			case 'constraint':
				return 409;
			case 'unavailable':
				return 503;
			case 'timeout':
				return 504;
			default:
				return 500;
		}
	}
}

/** Classify a Neo4j error code into a kind */
export function classifyError(code: string): Neo4jErrorKind {
	if (code.startsWith('Neo.ClientError.Security')) return 'authentication';
	if (code.startsWith('Neo.ClientError.Statement')) return 'syntax';
	if (code.startsWith('Neo.ClientError.Schema.ConstraintValidationFailed')) return 'constraint';
	if (code.startsWith('Neo.TransientError')) return 'unavailable';
	return 'unknown';
}
