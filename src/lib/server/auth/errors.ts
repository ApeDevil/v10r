export type AuthErrorKind =
	| 'unauthenticated'
	| 'forbidden'
	| 'expired'
	| 'rate_limited'
	| 'provider'
	| 'unknown';

export class AuthError extends Error {
	constructor(
		public readonly kind: AuthErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = 'AuthError';
	}
}

/** Classify an auth-related error into an AuthErrorKind. */
export function classifyAuthError(err: unknown): AuthError {
	if (err instanceof AuthError) return err;

	const message = err instanceof Error ? err.message : 'Unknown auth error';

	if (message.includes('401') || message.includes('Unauthorized')) {
		return new AuthError('unauthenticated', message, '401');
	}
	if (message.includes('403') || message.includes('Forbidden')) {
		return new AuthError('forbidden', message, '403');
	}
	if (message.includes('expired') || message.includes('session')) {
		return new AuthError('expired', message, 'EXPIRED');
	}
	if (message.includes('429') || message.includes('rate')) {
		return new AuthError('rate_limited', message, '429');
	}
	if (message.includes('OAuth') || message.includes('provider')) {
		return new AuthError('provider', message, 'PROVIDER');
	}

	return new AuthError('unknown', message);
}
