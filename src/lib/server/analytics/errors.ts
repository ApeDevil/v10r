import { ServerError } from '$lib/server/errors';

export type AnalyticsErrorKind = 'query' | 'seed' | 'consent' | 'timeout' | 'unknown';

export class AnalyticsError extends ServerError {
	constructor(
		public readonly kind: AnalyticsErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(kind, message, code);
		this.name = 'AnalyticsError';
	}

	override toStatus(): number {
		switch (this.kind) {
			case 'query':
				return 500;
			case 'seed':
				return 500;
			case 'consent':
				return 403;
			case 'timeout':
				return 504;
			default:
				return 500;
		}
	}
}
