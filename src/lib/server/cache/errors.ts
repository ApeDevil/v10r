import { ServerError } from '$lib/server/errors';

export type CacheErrorKind = 'credentials' | 'command' | 'timeout' | 'limit' | 'unavailable' | 'unknown';

export class CacheError extends ServerError {
	constructor(
		public readonly kind: CacheErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(kind, message, code);
		this.name = 'CacheError';
	}

	override toStatus(): number {
		switch (this.kind) {
			case 'credentials':
				return 502;
			case 'command':
				return 400;
			case 'timeout':
				return 504;
			case 'limit':
				return 429;
			case 'unavailable':
				return 503;
			default:
				return 500;
		}
	}
}

/** Classify an Upstash Redis error into a CacheErrorKind. */
export function classifyCacheError(err: unknown): CacheError {
	if (err instanceof CacheError) return err;

	const message = err instanceof Error ? err.message : 'Unknown cache error';
	const name = (err as { name?: string })?.name ?? '';

	if (message.includes('Unauthorized') || message.includes('401') || name === 'UrlError') {
		return new CacheError('credentials', message, '401');
	}
	if (message.includes('WRONGTYPE')) {
		return new CacheError('command', message, 'WRONGTYPE');
	}
	if (message.includes('timeout') || message.includes('ETIMEDOUT') || name === 'TimeoutError') {
		return new CacheError('timeout', message, 'TIMEOUT');
	}
	if (message.includes('rate') || message.includes('429')) {
		return new CacheError('limit', message, '429');
	}
	if (name === 'TypeError' || message.includes('fetch failed')) {
		return new CacheError('unavailable', message, 'NETWORK');
	}

	return new CacheError('unknown', message, name || undefined);
}
