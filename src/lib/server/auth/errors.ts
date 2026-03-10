import { ServerError } from '$lib/server/errors';

export type AuthErrorKind = 'unauthenticated' | 'forbidden' | 'expired' | 'rate_limited' | 'provider' | 'unknown';

export class AuthError extends ServerError {
	constructor(
		public readonly kind: AuthErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(kind, message, code);
		this.name = 'AuthError';
	}

	override toStatus(): number {
		switch (this.kind) {
			case 'unauthenticated':
				return 401;
			case 'forbidden':
				return 403;
			case 'expired':
				return 401;
			case 'rate_limited':
				return 429;
			case 'provider':
				return 502;
			default:
				return 500;
		}
	}
}
