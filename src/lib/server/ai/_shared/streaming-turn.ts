/**
 * Shared streaming-turn frame ordering + current-turn provider rotation for the
 * chatbot + rag-demo surfaces.
 *
 * ## Frame ordering (the original contract)
 *
 * Both surfaces open ONE assistant message manually (`writer.write({ type:'start', messageId })`)
 * before emitting any `message-metadata`, then stream the model text into it. The load-bearing
 * invariant — and the one that silently drifted, causing the "empty answer / answer⟷trace desync"
 * bug — is the CLOSE:
 *
 *   text/tool parts (sendStart:false, sendFinish:false) → afterText(...) → exactly one `finish`
 *
 * Writing `message-metadata` AFTER the message's `finish` frame makes the AI SDK v6 client
 * materialize a *second, empty* assistant message to hold it (or drops it) — so the answer and its
 * trace/citations land on different messages. This helper keeps the message OPEN: it pumps the text
 * stream itself (suppressing both the stream's own `start` and `finish`), then awaits the post-text
 * work, then writes the single `finish`. Any `message-metadata` that `afterText` flushes therefore
 * lands while the message is still open.
 *
 * ## Provider rotation (why `attempts`, not one result)
 *
 * The three streaming branches return their `Response` synchronously, so the orchestrator's outer
 * `try/catch` (which holds `tryFallback`) is UNREACHABLE for stream-phase errors, so a provider 429
 * on the first token would end the turn with a bare error part and an empty persisted row. This
 * helper therefore owns the rotation for the CURRENT turn: it takes a list of lazily-started
 * attempts (`[primary, ...fallbacks]`) and re-pumps the next provider into the SAME open message.
 *
 * That is only frame-order safe because of one rule: **an attempt may only be rotated away from
 * while it has produced ZERO content parts.** A failed content-less attempt leaves the open message
 * exactly as the caller left it (one `start`, plus whatever metadata the caller flushed), so the
 * next provider's parts are the first parts the client ever sees. Once ANY content part has been
 * pumped, rotating would duplicate text on the client, so a partial-stream failure never rotates.
 *
 * ## Failure shapes (what the client sees)
 *
 * The SDK reports a provider failure as an `error` part in the model stream, then rejects
 * `result.text` with a generic "No output generated". This helper never forwards that part: the
 * real error is captured from the part (`toUIMessageStream`'s `onError`) and decides the outcome.
 *
 * - **Nothing reached the client** → the error is rethrown WITHOUT `finish`. It propagates out of
 *   `execute` into `createUIMessageStream`'s `onError` (the orchestrator's `aiErrorFrameText`), which
 *   writes the ONE classified `[kind] message` error frame the client already parses.
 * - **Content already reached the client** → an `error` frame now would make the client drop the
 *   partial answer, so the message closes normally: `message-metadata { turnError }` (the classified
 *   kind + user-safe text), then `finish`.
 *
 * Either way `onAttemptFailure` fires exactly once per failed attempt with the captured error, so
 * the caller cools a provider in one place and never on the SDK's generic rejection.
 *
 * A stream that closes cleanly with ZERO content parts is the third shape: an **empty answer**
 * (`EMPTY_ANSWER`, kind `unavailable`). Left alone it would persist an empty message and show the
 * user nothing; treated as a content-less failure it rotates like one, or ends in the one error
 * frame when no provider is left.
 *
 * ## Abort shapes (the attempt's `abortSignal` fired)
 *
 * The SDK reports a fired `abortSignal` as an `abort` part and closes the stream; `result.text`
 * then rejects, or — after a completed tool step — resolves to the WRONG step's text. So the helper
 * keeps the current step's text itself, as the client received it, and uses that:
 *
 * - **The turn's cancellation** (`hooks.signal`: Stop, a closed tab) → nobody is listening. No
 *   rotation, no error frame, no cooldown. What had streamed is persisted through `afterText` so
 *   the conversation resumes with it, `onCancellation` fires once, the message is closed.
 * - **Any other abort** is the attempt's own deadline → a `timeout` failure, handled like every
 *   other failure above (rotation before content, `turnError` after it).
 *
 * In every case a partial answer is persisted exactly as the client received it — the SDK's
 * usage is only totalled on a finished step, so a cut-off attempt is charged as unknown usage.
 */
import type { InferUIMessageChunk, LanguageModelUsage, UIMessage, UIMessageStreamWriter } from 'ai';
import { AiError, aiErrorFrameText, classifyAiError, safeAiMessage } from '$lib/server/ai/errors';
import type { TurnError } from '$lib/types/ai-error';

/**
 * The slice of a `streamText` result this helper needs. Kept structural (rather than
 * `StreamTextResult<TOOLS, OUTPUT>`) so it doesn't depend on those generics and so tests can pass
 * a tiny fake. A real `streamText(...)` result satisfies it.
 */
export interface PumpableTextResult {
	toUIMessageStream(options: {
		sendStart: boolean;
		sendFinish: boolean;
		/** Called with the real error behind an `error` part; returns that part's text. */
		onError: (error: unknown) => string;
	}): AsyncIterable<InferUIMessageChunk<UIMessage>>;
	readonly text: PromiseLike<string>;
	readonly totalUsage: PromiseLike<LanguageModelUsage>;
}

/**
 * One provider attempt for this turn. `run()` is lazy on purpose — `streamText` starts the request
 * as soon as it is called, and `AbortSignal.timeout()` signals are single-use, so a fallback must
 * build its own call (with a fresh signal) only at the moment it is actually needed.
 */
export interface TurnAttempt {
	providerId: string | null;
	modelId: string | null;
	run: () => PumpableTextResult;
}

export type AttemptFailure = {
	providerId: string | null;
	/** The error the SDK reported for the attempt (a provider `APICallError`, an abort), never
	 * the generic "No output generated" that `result.text` rejects with. */
	error: unknown;
	/** True when the helper will roll over to another provider. False means this is the FINAL
	 * failure: the message is about to be closed (content was streamed) or the error rethrown
	 * (nothing was) — either way no further attempt runs. */
	willRetry: boolean;
};

export interface TurnHooks {
	onAttemptFailure: (failure: AttemptFailure) => void | Promise<void>;
	/** Skip an attempt without running it (circuit breaker). Cheap + idempotent — it is also used
	 * to look ahead at whether any eligible attempt remains. */
	isSkipped?: (providerId: string | null) => Promise<boolean>;
	onAttemptStart?: (attempt: TurnAttempt) => void;
	/**
	 * The turn's cancellation: aborted once the client has stopped listening. Every attempt's
	 * model call must carry it (folded into the attempt's `abortSignal`), which is what turns a
	 * Stop into an `abort` part here rather than a model that streams on to its timeout.
	 */
	signal?: AbortSignal;
	/** The client left. Fires once, before whatever had streamed is persisted. */
	onCancellation?: (cancellation: { providerId: string | null; contentParts: number }) => void;
}

/**
 * Error kinds worth rotating on. `unknown` is deliberately EXCLUDED: it is the catch-all bucket in
 * `classifyAiError`, so retrying it would burn a second provider's quota on a deterministic bug
 * (bad schema, serialization failure) that the next provider will hit identically.
 * `authentication` and `context_length` are excluded for the same reason.
 */
const RETRYABLE = new Set(['rate_limit', 'unavailable', 'timeout', 'model']);

/**
 * What an attempt that never finished a step reports: the SDK totals usage on `finish-step`
 * only, so a cut-off or aborted answer carries no counts — charged as nothing, never guessed.
 */
const UNKNOWN_USAGE: LanguageModelUsage = {
	inputTokens: undefined,
	inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
	outputTokens: undefined,
	outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
	totalTokens: undefined,
};

/**
 * Parts the client renders as the answer. Framing parts (`start-step`, `finish-step`,
 * `message-metadata`) carry nothing a second provider would duplicate, so they never pin the turn.
 */
function isContentPart(type: string): boolean {
	return (
		type.startsWith('text-') ||
		type.startsWith('reasoning-') ||
		type.startsWith('tool-') ||
		type.startsWith('source-') ||
		type === 'file'
	);
}

/** Does any attempt at or after `from` survive the skip check? */
async function anyEligible(attempts: TurnAttempt[], from: number, isSkipped: TurnHooks['isSkipped']): Promise<boolean> {
	for (let i = from; i < attempts.length; i++) {
		if (!isSkipped || !(await isSkipped(attempts[i].providerId))) return true;
	}
	return false;
}

export async function streamTextIntoOpenMessage(
	writer: UIMessageStreamWriter,
	/** `[primary, ...fallbacks]`, tried in order. */
	attempts: TurnAttempt[],
	/** Post-text work (citation verify, catalog, persistence, the generate-done step). Runs while
	 * the message is still open, so any metadata it flushes attaches to the right message. */
	afterText: (text: string, usage: LanguageModelUsage) => Promise<void>,
	hooks: TurnHooks,
): Promise<void> {
	let lastError: unknown;

	// Post-text work is best-effort: it is metadata/persistence, not the answer. A failure here
	// must not cost the user a streamed answer, so it is logged and the frame still closes.
	const settle = async (text: string, usage: LanguageModelUsage) => {
		try {
			await afterText(text, usage);
		} catch (err) {
			console.error('[ai:streaming-turn] afterText failed (answer already streamed):', err);
		}
	};

	for (let i = 0; i < attempts.length; i++) {
		const attempt = attempts[i];
		// Stopped during retrieval or between attempts: no model call for a client that left — an
		// aborted request still counts against a per-day quota. Checked before the breaker, so a
		// cancelled turn on cooled providers reads as cancelled, not as "every provider cooled".
		if (hooks.signal?.aborted) {
			hooks.onCancellation?.({ providerId: attempt.providerId, contentParts: 0 });
			writer.write({ type: 'finish' });
			return;
		}
		if (hooks.isSkipped && (await hooks.isSkipped(attempt.providerId))) continue;
		hooks.onAttemptStart?.(attempt);

		/** Content parts pumped into the open message. Non-zero pins us to this provider. */
		let contentParts = 0;
		/** The current step's text as the client received it — the answer when the SDK cannot
		 * resolve `text` (an abort, a cut transport). Reset per step to mean what `result.text` means. */
		let stepText = '';
		/** The attempt's `abortSignal` fired; the SDK closed the stream on the `abort` part. */
		let aborted = false;
		/** The real error behind the attempt's `error` part (or the pump's own rejection). */
		let failure: unknown;
		let outcome: { text: string; usage: LanguageModelUsage } | undefined;

		try {
			const result = attempt.run();
			// Pump the model's parts into the already-open message. sendStart:false — the caller
			// wrote `start` with a known messageId; sendFinish:false — WE close it after afterText.
			const parts = result.toUIMessageStream({
				sendStart: false,
				sendFinish: false,
				onError: (error) => {
					failure = error;
					return aiErrorFrameText(error);
				},
			});
			for await (const part of parts) {
				// Never forwarded: before content it would pin the turn to a provider that produced
				// nothing; after content the client drops the answer on it. See the failure shapes.
				if (part.type === 'error') continue;
				if (part.type === 'abort') {
					aborted = true;
					continue;
				}
				if (part.type === 'start-step') stepText = '';
				else if (part.type === 'text-delta') stepText += part.delta;
				if (isContentPart(part.type)) contentParts++;
				writer.write(part);
			}
			// `text`/`totalUsage` reject when generation failed after a clean-looking stream. After an
			// abort they are not asked: `text` would be a finished step's, not what just streamed.
			if (!aborted) outcome = { text: await result.text, usage: await result.totalUsage };
		} catch (err) {
			failure ??= err;
		}

		const cancelled = hooks.signal?.aborted === true;
		// An abort the caller did not ask for is the attempt's own deadline.
		if (aborted && !cancelled) failure ??= new AiError('timeout', 'The model call ran out of time.', 'TIMEOUT');
		// A clean stop with nothing in it (Gemini 2.5 Flash does this: finishReason `stop`, no text,
		// no tool call) would close as a silent empty message. It is a failure the user cannot tell
		// from a hang — and since nothing was pumped, the next provider may still answer.
		if (!aborted && !cancelled && failure === undefined && contentParts === 0)
			failure = new AiError('unavailable', 'The model returned no answer.', 'EMPTY_ANSWER');
		// A partial answer is persisted as the client received it, whatever ended the attempt.
		if (!outcome && contentParts > 0) outcome = { text: stepText, usage: UNKNOWN_USAGE };

		if (failure !== undefined) {
			lastError = failure;
			const { kind } = classifyAiError(failure);
			// A client that left gets no second provider — but the failure it did not cause is
			// still reported (and a 429 still cools) exactly once.
			const willRetry =
				!cancelled &&
				contentParts === 0 &&
				RETRYABLE.has(kind) &&
				(await anyEligible(attempts, i + 1, hooks.isSkipped));
			await hooks.onAttemptFailure({ providerId: attempt.providerId, error: failure, willRetry });
			if (willRetry) continue;
			if (!cancelled) {
				// Nothing reached the client: rethrow WITHOUT `finish` — the caller's stream `onError`
				// writes the one classified error frame.
				if (contentParts === 0) throw failure;
				// The client holds part of an answer. Say what happened on the message, then close it.
				const turnError: TurnError = { kind, message: safeAiMessage(kind) };
				writer.write({ type: 'message-metadata', messageMetadata: { turnError } });
			}
		} else if (!cancelled && !outcome) {
			throw new Error('streaming attempt ended with neither an outcome nor a failure');
		}

		if (cancelled) hooks.onCancellation?.({ providerId: attempt.providerId, contentParts });
		if (outcome) await settle(outcome.text, outcome.usage);
		writer.write({ type: 'finish' });
		return;
	}

	// Every attempt was skipped (all providers cooled). Nothing was written to the open message, so
	// rethrowing lands on the caller's `onError` exactly like a final failure would.
	throw lastError ?? new AiError('unavailable', 'No AI provider was eligible for this turn.', 'ALL_COOLED');
}
