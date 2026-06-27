/**
 * Shared streaming-turn frame ordering for the chatbot + rag-demo surfaces.
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
 * trace/citations land on different messages. The previous code wrote that metadata in a
 * fire-and-forget `streamText` `onFinish` that ran *after* `execute` returned via
 * `writer.merge(toUIMessageStream())` (whose `sendFinish` defaults to `true`).
 *
 * This helper keeps the message OPEN: it pumps the text stream itself (suppressing both the
 * stream's own `start` and `finish`), then awaits the post-text work, then writes the single
 * `finish`. Any `message-metadata` that `afterText` flushes therefore lands while the message is
 * still open. Centralizing it here keeps the two surfaces from drifting again.
 */
import type { InferUIMessageChunk, LanguageModelUsage, UIMessage, UIMessageStreamWriter } from 'ai';

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

export async function streamTextIntoOpenMessage(
	writer: UIMessageStreamWriter,
	result: PumpableTextResult,
	/** Post-text work (citation verify, catalog, persistence, the generate-done step). Runs while
	 * the message is still open, so any metadata it flushes attaches to the right message. */
	afterText: (text: string, usage: LanguageModelUsage) => Promise<void>,
): Promise<void> {
	// Pump the model's text/tool parts into the already-open message. sendStart:false — the caller
	// wrote `start` with a known messageId; sendFinish:false — WE close it after afterText.
	for await (const part of result.toUIMessageStream({ sendStart: false, sendFinish: false })) {
		writer.write(part);
	}

	// `text`/`totalUsage` reject if generation failed; in that case streamText's own `onError`
	// already emitted the terminal error step, so skip afterText but still close the message.
	try {
		const text = await result.text;
		const usage = await result.totalUsage;
		await afterText(text, usage);
	} catch (err) {
		console.error('[ai:streaming-turn] generation failed before afterText:', err);
	}

	writer.write({ type: 'finish' });
}
