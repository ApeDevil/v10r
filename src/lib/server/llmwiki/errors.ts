/**
 * llmwiki domain errors. Mirrors the rawrag error pattern so the shared
 * error-to-status mapper in $lib/server/errors stays consistent.
 */

export type LlmwikiErrorKind = 'search' | 'hydrate' | 'compile' | 'lint' | 'verify' | 'not_found' | 'invalid_input';

export class LlmwikiError extends Error {
	constructor(
		public readonly kind: LlmwikiErrorKind,
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = 'LlmwikiError';
	}

	toStatus(): number {
		switch (this.kind) {
			case 'not_found':
				return 404;
			case 'invalid_input':
				return 400;
			default:
				return 500;
		}
	}
}
