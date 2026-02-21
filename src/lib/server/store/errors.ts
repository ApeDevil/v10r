export type StoreErrorKind =
	| 'credentials'
	| 'not_found'
	| 'forbidden'
	| 'timeout'
	| 'limit'
	| 'unavailable'
	| 'unknown';

export class StoreError extends Error {
	constructor(
		public readonly kind: StoreErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = 'StoreError';
	}
}

/** Classify an S3/R2 error into a StoreErrorKind. */
export function classifyS3Error(err: unknown): StoreError {
	if (err instanceof StoreError) return err;

	const name = (err as { name?: string })?.name ?? '';
	const code = (err as { Code?: string })?.Code ?? (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode?.toString() ?? '';
	const message = err instanceof Error ? err.message : 'Unknown storage error';

	if (name === 'NoSuchKey' || name === 'NotFound' || code === '404') {
		return new StoreError('not_found', message, name);
	}
	if (name === 'NoSuchBucket' || name === 'InvalidAccessKeyId' || code === '401' || code === '403') {
		return new StoreError('credentials', message, name);
	}
	if (name === 'AccessDenied' || name === 'SignatureDoesNotMatch') {
		return new StoreError('forbidden', message, name);
	}
	if (name === 'TimeoutError' || name === 'RequestTimeout') {
		return new StoreError('timeout', message, name);
	}
	if (name === 'SlowDown' || name === 'ServiceUnavailable') {
		return new StoreError('unavailable', message, name);
	}

	return new StoreError('unknown', message, name || undefined);
}
