export type Neo4jErrorKind =
	| 'authentication'
	| 'http'
	| 'syntax'
	| 'constraint'
	| 'unavailable'
	| 'timeout'
	| 'unknown';

export class Neo4jError extends Error {
	constructor(
		public readonly kind: Neo4jErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = 'Neo4jError';
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
