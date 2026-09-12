/**
 * The failure classes an AI turn can end in — one vocabulary for the server classifier
 * (`$lib/server/ai/errors`), the `[kind] message` text of a stream's `error` frame, the
 * `X-AI-Error-Kind` header of a pre-stream refusal, and the `turnError` a partial answer
 * carries. Framework-free so the chat components can read it without crossing the
 * server boundary.
 */
export const AI_ERROR_KINDS = [
	'authentication',
	'rate_limit',
	'model',
	'context_length',
	'timeout',
	'unavailable',
	'unknown',
] as const;

export type AiErrorKind = (typeof AI_ERROR_KINDS)[number];

/**
 * Why an answer stopped short. Streamed as `message-metadata.turnError` when the failure
 * came AFTER content had reached the client — an `error` frame there would make the client
 * drop the partial answer, so the message closes normally and says what happened instead.
 * `message` is the user-safe text for `kind`; never provider prose.
 */
export interface TurnError {
	kind: AiErrorKind;
	message: string;
}

/**
 * The kind a stream's `error` frame names: its text is `[kind] user-safe message`
 * (`aiErrorFrameText` on the server). Null for any other text — a guard's JSON refusal
 * body, a network failure — which the client words on its own.
 */
export function parseAiErrorKind(text: string): AiErrorKind | null {
	const kind = /^\[(\w+)\]/.exec(text)?.[1];
	return kind && (AI_ERROR_KINDS as readonly string[]).includes(kind) ? (kind as AiErrorKind) : null;
}
