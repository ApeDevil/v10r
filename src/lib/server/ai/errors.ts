import { ServerError } from '$lib/server/errors';

export type AiErrorKind =
	| 'authentication'
	| 'rate_limit'
	| 'model'
	| 'context_length'
	| 'timeout'
	| 'unavailable'
	| 'unknown';

export class AiError extends ServerError {
	constructor(
		public readonly kind: AiErrorKind,
		message: string,
		public readonly code?: string,
	) {
		super(kind, message, code);
		this.name = 'AiError';
	}

	override toStatus(): number {
		return aiErrorToStatus(this.kind);
	}
}

/** Classify an AI SDK / provider error into an AiError. */
export function classifyAiError(err: unknown): AiError {
	if (err instanceof AiError) return err;

	const message = err instanceof Error ? err.message : 'Unknown AI error';
	const status = (err as { status?: number })?.status;
	const code = (err as { code?: string })?.code;

	if (status === 401 || status === 403 || message.includes('authentication')) {
		return new AiError('authentication', message, String(status ?? '401'));
	}
	if (status === 429 || message.includes('rate') || code === 'rate_limit_exceeded') {
		return new AiError('rate_limit', message, '429');
	}
	if (status === 404 || message.includes('model')) {
		return new AiError('model', message, String(status ?? '404'));
	}
	if (message.includes('context length') || message.includes('token')) {
		return new AiError('context_length', message, 'CONTEXT_LENGTH');
	}
	if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
		return new AiError('timeout', message, 'TIMEOUT');
	}
	if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
		return new AiError('unavailable', message, 'NETWORK');
	}

	return new AiError('unknown', message, code ?? undefined);
}

/** User-safe message per kind — never exposes provider internals. */
const SAFE_AI_MESSAGES: Record<AiErrorKind, string> = {
	authentication: 'AI service authentication failed. Please try again later.',
	rate_limit: 'Too many AI requests. Please wait a moment.',
	model: 'AI model unavailable. Please try again later.',
	context_length: 'Message too long for the AI to process. Try a shorter message.',
	timeout: 'AI service timed out. Please try again.',
	unavailable: 'AI service is temporarily unavailable.',
	unknown: 'An unexpected AI error occurred.',
};

/** Get a user-safe error message that won't leak provider details. */
export function safeAiMessage(kind: AiErrorKind): string {
	return SAFE_AI_MESSAGES[kind];
}

/** Map AiErrorKind to HTTP status code */
export function aiErrorToStatus(kind: AiErrorKind): number {
	switch (kind) {
		case 'authentication':
			return 502;
		case 'rate_limit':
			return 429;
		case 'model':
			return 502;
		case 'context_length':
			return 400;
		case 'timeout':
			return 504;
		case 'unavailable':
			return 503;
		default:
			return 500;
	}
}
