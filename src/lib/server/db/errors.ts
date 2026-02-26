import { ServerError } from '$lib/server/errors';

export type DbErrorKind =
	| 'connection'
	| 'constraint'
	| 'not_found'
	| 'timeout'
	| 'serialization'
	| 'permission'
	| 'unknown';

export class DbError extends ServerError {
	constructor(
		public readonly kind: DbErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(kind, message, code);
		this.name = 'DbError';
	}

	override toStatus(): number {
		switch (this.kind) {
			case 'connection':
				return 503;
			case 'constraint':
				return 409;
			case 'not_found':
				return 404;
			case 'timeout':
				return 504;
			case 'serialization':
				return 409;
			case 'permission':
				return 502;
			default:
				return 500;
		}
	}
}

/** Classify a PG error code into a kind. */
function classifyCode(code: string): DbErrorKind {
	if (code.startsWith('23')) return 'constraint';
	if (code.startsWith('08')) return 'connection';
	if (code === '40001' || code === '40P01') return 'serialization';
	if (code === '57014') return 'timeout';
	if (code === '42501' || code.startsWith('28')) return 'permission';
	return 'unknown';
}

/** Classify an unknown error into a DbError. */
export function classifyDbError(err: unknown): DbError {
	if (err instanceof DbError) return err;

	const message = err instanceof Error ? err.message : 'Unknown database error';
	const code = (err as { code?: string })?.code;

	if (code) {
		return new DbError(classifyCode(code), message, code);
	}

	if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
		return new DbError('timeout', message, 'TIMEOUT');
	}
	if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
		return new DbError('connection', message, 'NETWORK');
	}

	return new DbError('unknown', message);
}
