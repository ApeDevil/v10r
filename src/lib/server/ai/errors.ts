import { APICallError, NoOutputGeneratedError } from 'ai';
import { ServerError } from '$lib/server/errors';
import type { AiErrorKind } from '$lib/types/ai-error';

export type { AiErrorKind };

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

/** The provider's HTTP status is the one honest signal; null for a status this table does not know. */
function kindOfStatus(status: number | undefined): AiErrorKind | null {
	if (status === undefined) return null;
	if (status === 401 || status === 403) return 'authentication';
	if (status === 429) return 'rate_limit';
	if (status === 404) return 'model';
	if (status === 408) return 'timeout';
	if (status >= 500) return 'unavailable';
	return null;
}

/** Classify an AI SDK / provider error into an AiError. */
export function classifyAiError(err: unknown): AiError {
	if (err instanceof AiError) return err;

	const message = err instanceof Error ? err.message : 'Unknown AI error';

	// The SDK's transport error carries the provider's own status. Its message is the
	// provider's prose ("You exceeded your current quota… retry in 33.5s") and is only
	// consulted for a status the table does not know (a 400 that names the token limit).
	if (APICallError.isInstance(err)) {
		const kind = kindOfStatus(err.statusCode);
		if (kind) return new AiError(kind, message, String(err.statusCode));
	}
	// "No output generated. Check the stream for errors." is the SDK's symptom of a failure it
	// already reported through `onError`; the cause is classified there. The text itself says
	// nothing — and its "gene-rate-d" once matched the rate-limit rule.
	if (NoOutputGeneratedError.isInstance(err)) return new AiError('unknown', message);

	// Raw fetch/undici errors report `status`; the SDK's `statusCode` was read above.
	const status = (err as { statusCode?: number })?.statusCode ?? (err as { status?: number })?.status;
	const code = (err as { code?: string })?.code;

	if (status === 401 || status === 403 || message.includes('authentication')) {
		return new AiError('authentication', message, String(status ?? '401'));
	}
	if (status === 429 || /\brate[ -]?limit/i.test(message) || code === 'rate_limit_exceeded') {
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
	rate_limit: 'The AI provider is over its limit right now. Please try again in a minute.',
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

/**
 * The text of a stream's `error` frame: `[kind] user-safe message`. The chat clients parse
 * the `[kind]` prefix to pick their own wording; the provider's prose never reaches them.
 */
export function aiErrorFrameText(err: unknown): string {
	const { kind } = classifyAiError(err);
	return `[${kind}] ${safeAiMessage(kind)}`;
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
