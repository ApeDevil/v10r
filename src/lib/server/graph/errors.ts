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

/**
 * Client-safe message per kind — the Neo4j mirror of `safeDbMessage`.
 *
 * A driver message can carry fragments of the Cypher that produced it, i.e.
 * label and property names. The Postgres path already launders its errors this
 * way; the graph path was returning `err.message` verbatim to the client.
 */
const SAFE_GRAPH_MESSAGES: Record<Neo4jErrorKind, string> = {
	authentication: 'Graph database access denied.',
	http: 'The graph database is unreachable.',
	syntax: 'The graph query was rejected.',
	constraint: 'A graph constraint prevented this change.',
	unavailable: 'The graph database is temporarily unavailable. Please retry.',
	timeout: 'The graph query took too long. Please retry.',
	unknown: 'An unexpected graph database error occurred.',
};

/** Get a user-safe message that won't leak query or schema details. */
export function safeGraphMessage(kind: Neo4jErrorKind): string {
	return SAFE_GRAPH_MESSAGES[kind];
}

/** Classify a Neo4j error code into a kind */
export function classifyError(code: string): Neo4jErrorKind {
	if (code.startsWith('Neo.ClientError.Security')) return 'authentication';
	if (code.startsWith('Neo.ClientError.Statement')) return 'syntax';
	if (code.startsWith('Neo.ClientError.Schema.ConstraintValidationFailed')) return 'constraint';
	if (code.startsWith('Neo.TransientError')) return 'unavailable';
	return 'unknown';
}
