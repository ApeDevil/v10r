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
 * while it has produced ZERO client-visible frames.** A failed zero-part attempt leaves the open
 * message exactly as the caller left it (one `start`, plus whatever metadata the caller flushed),
 * so the next provider's parts are the first parts the client ever sees. Once ANY part has been
 * pumped, rotating would duplicate text on the client, so a partial-stream failure always rethrows.
 *
 * A rethrow is deliberate and does NOT write `finish`: it propagates out of `execute` into
 * `createUIMessageStream`'s `onError` (the orchestrator's `classifyStreamError`), which emits the
 * `[kind] message` error part the client already parses, and owns the final-failure cooldown.
 */
import type { InferUIMessageChunk, LanguageModelUsage, UIMessage, UIMessageStreamWriter } from 'ai';
import { AIError, classifyAIError } from '$lib/server/ai/errors';

/**
 * The slice of a `streamText` result this helper needs. Kept structural (rather than
 * `StreamTextResult<TOOLS, OUTPUT>`) so it doesn't depend on those generics and so tests can pass
 * a tiny fake. A real `streamText(...)` result satisfies it.
 */
export interface PumpableTextResult {
	toUIMessageStream(options: {
		sendStart: boolean;
		sendFinish: boolean;
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
	error: unknown;
	/** True when the helper will roll over to another provider — i.e. the caller should cool the
	 * failed provider itself. False means this is the FINAL failure and the error is about to be
	 * rethrown, where the caller's stream `onError` owns classification + cooldown. */
	willRetry: boolean;
};

export interface TurnHooks {
	onAttemptFailure: (failure: AttemptFailure) => void | Promise<void>;
	/** Skip an attempt without running it (circuit breaker). Cheap + idempotent — it is also used
	 * to look ahead at whether any eligible attempt remains. */
	isSkipped?: (providerId: string | null) => Promise<boolean>;
	onAttemptStart?: (attempt: TurnAttempt) => void;
}

/**
 * Error kinds worth rotating on. `unknown` is deliberately EXCLUDED: it is the catch-all bucket in
 * `classifyAIError`, so retrying it would burn a second provider's quota on a deterministic bug
 * (bad schema, serialization failure) that the next provider will hit identically.
 * `authentication` and `context_length` are excluded for the same reason.
 */
const RETRYABLE = new Set(['rate_limit', 'unavailable', 'timeout', 'model']);

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

	for (let i = 0; i < attempts.length; i++) {
		const attempt = attempts[i];
		if (hooks.isSkipped && (await hooks.isSkipped(attempt.providerId))) continue;
		hooks.onAttemptStart?.(attempt);

		/** Any part pumped into the open message. Non-zero pins us to this provider. */
		let visibleParts = 0;
		let text: string;
		let usage: LanguageModelUsage;

		try {
			const result = attempt.run();
			// Pump the model's parts into the already-open message. sendStart:false — the caller
			// wrote `start` with a known messageId; sendFinish:false — WE close it after afterText.
			for await (const part of result.toUIMessageStream({ sendStart: false, sendFinish: false })) {
				visibleParts++;
				writer.write(part);
			}
			// `text`/`totalUsage` reject when generation failed after a clean-looking stream.
			text = await result.text;
			usage = await result.totalUsage;
		} catch (err) {
			lastError = err;
			const { kind } = classifyAIError(err);
			const willRetry =
				visibleParts === 0 && RETRYABLE.has(kind) && (await anyEligible(attempts, i + 1, hooks.isSkipped));
			await hooks.onAttemptFailure({ providerId: attempt.providerId, error: err, willRetry });
			if (willRetry) continue;
			// Final failure (or a partial stream we must not duplicate): rethrow WITHOUT `finish`.
			throw err;
		}

		// Post-text work is best-effort: it is metadata/persistence, not the answer. A failure here
		// must not cost the user a streamed answer, so it is logged and the frame still closes.
		try {
			await afterText(text, usage);
		} catch (err) {
			console.error('[ai:streaming-turn] afterText failed (answer already streamed):', err);
		}

		writer.write({ type: 'finish' });
		return;
	}

	// Every attempt was skipped (all providers cooled). Nothing was written to the open message, so
	// rethrowing lands on the caller's `onError` exactly like a final failure would.
	throw lastError ?? new AIError('unavailable', 'No AI provider was eligible for this turn.', 'ALL_COOLED');
}
