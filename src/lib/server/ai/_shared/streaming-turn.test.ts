import {
	APICallError,
	createUIMessageStream,
	type LanguageModelUsage,
	streamText,
	type UIMessageStreamWriter,
} from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { AiError, aiErrorFrameText } from '$lib/server/ai/errors';
import {
	type AttemptFailure,
	type PumpableTextResult,
	streamTextIntoOpenMessage,
	type TurnAttempt,
} from './streaming-turn';

type Part = { type: string; [k: string]: unknown };

function makeWriter() {
	const writes: Part[] = [];
	// `rec` is loosely typed for in-test writes; `writer` is the same object cast to the SDK type
	// that the helper expects.
	const rec = {
		write: (p: Part) => {
			writes.push(p);
		},
		merge: () => {
			throw new Error('merge must not be used — the helper pumps parts itself');
		},
		onError: undefined,
	};
	return { rec, writer: rec as unknown as UIMessageStreamWriter, writes };
}

const USAGE = { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as LanguageModelUsage;

/**
 * A fake result with the SDK's failure shape: a provider error surfaces as an `error` part
 * (through `onError`, which the helper uses to capture the real error) and `text` then rejects
 * with the generic "No output generated" — never the cause.
 */
function makeResult(opts: {
	parts: Part[];
	text?: string;
	usage?: LanguageModelUsage;
	/** Fail after yielding `parts`: an `error` part, then `text` rejects generically. */
	failWith?: unknown;
	/** Fail without an `error` part — the pump itself rejects (an abort, a transport cut). */
	throwWith?: unknown;
	onStream?: (o: { sendStart: boolean; sendFinish: boolean }) => void;
}): PumpableTextResult {
	return {
		toUIMessageStream(streamOpts: { sendStart: boolean; sendFinish: boolean; onError: (e: unknown) => string }) {
			opts.onStream?.(streamOpts);
			return (async function* () {
				for (const p of opts.parts) yield p;
				if (opts.failWith) yield { type: 'error', errorText: streamOpts.onError(opts.failWith) };
				if (opts.throwWith) throw opts.throwWith;
			})();
		},
		get text() {
			return opts.failWith
				? Promise.reject(new Error('No output generated. Check the stream for errors.'))
				: Promise.resolve(opts.text ?? 'hi');
		},
		get totalUsage() {
			return Promise.resolve(opts.usage ?? USAGE);
		},
	} as unknown as PumpableTextResult;
}

/** A single-attempt chain — the shape every pre-rotation call site used to have. */
function only(result: PumpableTextResult, providerId = 'groq'): TurnAttempt[] {
	return [{ providerId, modelId: 'm-1', run: () => result }];
}

/** Hooks that record failures and never skip. */
function makeHooks(extra: Partial<Parameters<typeof streamTextIntoOpenMessage>[3]> = {}) {
	const failures: AttemptFailure[] = [];
	const started: (string | null)[] = [];
	return {
		failures,
		started,
		hooks: {
			onAttemptFailure: (f: AttemptFailure) => {
				failures.push(f);
			},
			onAttemptStart: (a: TurnAttempt) => {
				started.push(a.providerId);
			},
			...extra,
		},
	};
}

const rateLimited = () => new AiError('rate_limit', 'You exceeded your current quota, retry in 33.5s', '429');

describe('streamTextIntoOpenMessage', () => {
	// success path (unchanged contract)

	it('writes text parts → afterText metadata → exactly one finish, with NO metadata after finish', async () => {
		const { rec, writer, writes } = makeWriter();
		let streamOpts: { sendStart: boolean; sendFinish: boolean } | null = null;
		const result = makeResult({
			parts: [{ type: 'text-start' }, { type: 'text-delta', delta: 'hi' }, { type: 'text-end' }],
			onStream: (o) => {
				streamOpts = o;
			},
		});
		const { hooks } = makeHooks();

		await streamTextIntoOpenMessage(
			writer,
			only(result),
			async () => {
				// Simulate the late citation/catalog flush.
				rec.write({ type: 'message-metadata', messageMetadata: { pipeline: ['done'] } });
			},
			hooks,
		);

		// The model stream's own start + finish are suppressed (caller owns the frame).
		expect(streamOpts).toMatchObject({ sendStart: false, sendFinish: false });

		const types = writes.map((w) => w.type);
		expect(types).toEqual(['text-start', 'text-delta', 'text-end', 'message-metadata', 'finish']);
		// Exactly one finish, and it is dead last — nothing (esp. metadata) follows it.
		expect(types.filter((t) => t === 'finish')).toHaveLength(1);
		expect(types.indexOf('finish')).toBe(types.length - 1);
		expect(types.slice(types.indexOf('finish') + 1)).not.toContain('message-metadata');
	});

	it('passes the resolved text + usage to afterText', async () => {
		const { writer } = makeWriter();
		const seen: { text?: string; usage?: LanguageModelUsage } = {};
		const result = makeResult({
			parts: [{ type: 'text-delta', delta: 'x' }],
			text: 'the answer',
			usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 } as LanguageModelUsage,
		});
		const { hooks, failures } = makeHooks();

		await streamTextIntoOpenMessage(
			writer,
			only(result),
			async (text, usage) => {
				seen.text = text;
				seen.usage = usage;
			},
			hooks,
		);

		expect(seen.text).toBe('the answer');
		expect(seen.usage?.inputTokens).toBe(7);
		expect(failures).toHaveLength(0);
	});

	// rotation — decided on the captured error, never on the SDK's generic rejection

	it('rotates to the next provider when the primary fails with ZERO content parts', async () => {
		const { writer, writes } = makeWriter();
		const boom = rateLimited();
		const primary = makeResult({ parts: [], failWith: boom });
		const secondary = makeResult({
			parts: [{ type: 'text-start' }, { type: 'text-delta', delta: 'from fallback' }],
			text: 'from fallback',
		});
		const { hooks, failures, started } = makeHooks();
		let afterTextCalls = 0;

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'groq', modelId: 'm-groq', run: () => primary },
				{ providerId: 'openai', modelId: 'm-openai', run: () => secondary },
			],
			async () => {
				afterTextCalls++;
			},
			hooks,
		);

		// The primary's `error` part never reached the client; the second provider's parts were
		// pumped into the SAME open message; exactly one finish.
		expect(writes.map((w) => w.type)).toEqual(['text-start', 'text-delta', 'finish']);
		expect(afterTextCalls).toBe(1);
		expect(started).toEqual(['groq', 'openai']);
		expect(failures).toHaveLength(1);
		// The hook sees the provider's error, not "No output generated".
		expect(failures[0]).toMatchObject({ providerId: 'groq', willRetry: true, error: boom });
	});

	it('framing parts (start-step) do not pin the turn — a step that never produced content still rotates', async () => {
		const { writer, writes } = makeWriter();
		const primary = makeResult({ parts: [{ type: 'start-step' }], failWith: rateLimited() });
		const secondary = makeResult({ parts: [{ type: 'start-step' }, { type: 'text-delta', delta: 'ok' }] });
		const { hooks, failures } = makeHooks();

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'groq', modelId: 'm-groq', run: () => primary },
				{ providerId: 'openai', modelId: 'm-openai', run: () => secondary },
			],
			async () => {},
			hooks,
		);

		expect(writes.map((w) => w.type)).toEqual(['start-step', 'start-step', 'text-delta', 'finish']);
		expect(failures[0].willRetry).toBe(true);
	});

	it('a clean stream with zero content parts is an empty answer: rotates like a content-less failure', async () => {
		const { writer, writes } = makeWriter();
		// Gemini 2.5 Flash shape: start-step, finish-step, finishReason `stop`, nothing in between.
		const primary = makeResult({ parts: [{ type: 'start-step' }, { type: 'finish-step' }], text: '' });
		const secondary = makeResult({ parts: [{ type: 'text-start' }, { type: 'text-delta', delta: 'ok' }], text: 'ok' });
		const { hooks, failures } = makeHooks();
		const persisted: string[] = [];

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'google', modelId: 'm-google', run: () => primary },
				{ providerId: 'groq', modelId: 'm-groq', run: () => secondary },
			],
			async (text) => {
				persisted.push(text);
			},
			hooks,
		);

		expect(writes.map((w) => w.type)).toEqual(['start-step', 'finish-step', 'text-start', 'text-delta', 'finish']);
		expect(persisted).toEqual(['ok']);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({ providerId: 'google', willRetry: true });
		expect((failures[0].error as AiError).code).toBe('EMPTY_ANSWER');
	});

	it('an empty answer with no provider left is the final failure: nothing persisted, no finish, rethrown', async () => {
		const { writer, writes } = makeWriter();
		const empty = makeResult({ parts: [{ type: 'start-step' }, { type: 'finish-step' }], text: '' });
		const { hooks, failures } = makeHooks();
		let afterTextCalls = 0;

		await expect(
			streamTextIntoOpenMessage(
				writer,
				only(empty, 'google'),
				async () => {
					afterTextCalls++;
				},
				hooks,
			),
		).rejects.toMatchObject({ kind: 'unavailable', code: 'EMPTY_ANSWER' });

		expect(writes.map((w) => w.type)).toEqual(['start-step', 'finish-step']);
		expect(afterTextCalls).toBe(0);
		expect(failures[0]).toMatchObject({ providerId: 'google', willRetry: false });
	});

	it('rotates on a pump rejection (no error part) only while zero content parts have been emitted', async () => {
		const { writer, writes } = makeWriter();
		const primary = makeResult({ parts: [], throwWith: rateLimited() });
		const secondary = makeResult({ parts: [{ type: 'text-delta', delta: 'ok' }] });
		const { hooks, failures } = makeHooks();

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'groq', modelId: 'm-groq', run: () => primary },
				{ providerId: 'openai', modelId: 'm-openai', run: () => secondary },
			],
			async () => {},
			hooks,
		);

		expect(writes.map((w) => w.type)).toEqual(['text-delta', 'finish']);
		expect(failures[0].willRetry).toBe(true);
	});

	// after content: no rotation, no error frame — the message closes with what happened

	it('after a content part: no rotation, no error frame — turnError metadata, then finish', async () => {
		const { writer, writes } = makeWriter();
		const boom = rateLimited();
		const primary = makeResult({ parts: [{ type: 'text-delta', delta: 'partial' }], failWith: boom });
		const secondary = vi.fn(() => makeResult({ parts: [{ type: 'text-delta', delta: 'dupe' }] }));
		const { hooks, failures } = makeHooks();
		const persisted: { text: string; usage: LanguageModelUsage }[] = [];

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'groq', modelId: 'm-groq', run: () => primary },
				{ providerId: 'openai', modelId: 'm-openai', run: secondary },
			],
			async (text, usage) => {
				persisted.push({ text, usage });
			},
			hooks,
		);

		// The partial text stays, the fallback never runs (it would duplicate it), and the
		// message is CLOSED — the failure travels on it, not as an `error` frame after text.
		expect(writes).toEqual([
			{ type: 'text-delta', delta: 'partial' },
			{
				type: 'message-metadata',
				messageMetadata: {
					turnError: {
						kind: 'rate_limit',
						message: 'The AI provider is over its limit right now. Please try again in a minute.',
					},
				},
			},
			{ type: 'finish' },
		]);
		expect(secondary).not.toHaveBeenCalled();
		// The SDK rejected the text; what the client received is persisted anyway, charged as
		// unknown usage rather than a guess.
		expect(persisted).toEqual([{ text: 'partial', usage: expect.objectContaining({ outputTokens: undefined }) }]);
		expect(failures).toEqual([{ providerId: 'groq', error: boom, willRetry: false }]);
	});

	it('persists a partial answer the SDK still resolved (step closed on the error part)', async () => {
		const { rec, writer, writes } = makeWriter();
		const boom = new AiError('unavailable', 'stream cut', '503');
		// An `error` part, but `text` resolves: the step finished with finishReason 'error'.
		const primary: PumpableTextResult = {
			toUIMessageStream({ onError }) {
				return (async function* () {
					yield { type: 'text-delta', delta: 'half an answer' } as never;
					yield { type: 'error', errorText: onError(boom) } as never;
				})();
			},
			text: Promise.resolve('half an answer'),
			totalUsage: Promise.resolve(USAGE),
		};
		const { hooks, failures } = makeHooks();
		const seen: string[] = [];

		await streamTextIntoOpenMessage(
			writer,
			only(primary),
			async (text) => {
				seen.push(text);
				rec.write({ type: 'message-metadata', messageMetadata: { pipeline: ['generate:error'] } });
			},
			hooks,
		);

		expect(seen).toEqual(['half an answer']);
		expect(writes.map((w) => w.type)).toEqual(['text-delta', 'message-metadata', 'message-metadata', 'finish']);
		expect(writes[1]).toMatchObject({ messageMetadata: { turnError: { kind: 'unavailable' } } });
		expect(failures).toEqual([{ providerId: 'groq', error: boom, willRetry: false }]);
	});

	// zero content, final: rethrow without finish (the caller writes the one error frame)

	it("rethrows the captured error on kind 'unknown' even with attempts remaining", async () => {
		const { writer, writes } = makeWriter();
		const boom = new AiError('unknown', 'tool schema is malformed');
		const primary = makeResult({ parts: [], failWith: boom });
		const secondary = vi.fn(() => makeResult({ parts: [{ type: 'text-delta', delta: 'never' }] }));
		const { hooks, failures } = makeHooks();

		await expect(
			streamTextIntoOpenMessage(
				writer,
				[
					{ providerId: 'groq', modelId: 'm-groq', run: () => primary },
					{ providerId: 'openai', modelId: 'm-openai', run: secondary },
				],
				async () => {},
				hooks,
			),
		).rejects.toBe(boom);

		expect(secondary).not.toHaveBeenCalled();
		// Not even the `error` part: the caller's stream `onError` owns the one error frame.
		expect(writes).toHaveLength(0);
		expect(failures[0].willRetry).toBe(false);
	});

	// abort: the attempt's abortSignal fired — the turn's cancellation, or its own deadline

	/** The SDK's abort shape: an `abort` part closes the stream; `text`/`totalUsage` reject with the
	 * reason (pre-caught: the helper must never ask for them after an abort). */
	function abortedResult(parts: Part[], cancel?: AbortController): PumpableTextResult {
		const reason = new DOMException('This operation was aborted', 'AbortError');
		const rejected = Promise.reject(reason);
		rejected.catch(() => {});
		return {
			toUIMessageStream() {
				return (async function* () {
					for (const p of parts) yield p as never;
					// Stop arrives mid-stream: the signal fires, the SDK answers with the abort part.
					cancel?.abort();
					yield { type: 'abort' } as never;
				})();
			},
			text: rejected as Promise<string>,
			totalUsage: rejected as Promise<LanguageModelUsage>,
		};
	}

	/** The turn's cancellation, not yet aborted. */
	const cancellation = () => new AbortController();

	it('cancelled after content: persists the streamed text, no rotation, no turnError, no failure', async () => {
		const { writer, writes } = makeWriter();
		const cancel = cancellation();
		const primary = abortedResult([{ type: 'text-start' }, { type: 'text-delta', delta: 'Half an ' }], cancel);
		const secondary = vi.fn(() => makeResult({ parts: [{ type: 'text-delta', delta: 'dupe' }] }));
		const cancellations: { providerId: string | null; contentParts: number }[] = [];
		const { hooks, failures } = makeHooks({
			signal: cancel.signal,
			onCancellation: (c) => {
				cancellations.push(c);
			},
		});
		const persisted: { text: string; usage: LanguageModelUsage }[] = [];

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'google', modelId: 'm', run: () => primary },
				{ providerId: 'groq', modelId: 'm', run: secondary },
			],
			async (text, usage) => {
				persisted.push({ text, usage });
			},
			hooks,
		);

		expect(writes).toEqual([{ type: 'text-start' }, { type: 'text-delta', delta: 'Half an ' }, { type: 'finish' }]);
		expect(persisted).toEqual([{ text: 'Half an ', usage: expect.objectContaining({ inputTokens: undefined }) }]);
		expect(secondary).not.toHaveBeenCalled();
		expect(failures).toEqual([]);
		expect(cancellations).toEqual([{ providerId: 'google', contentParts: 2 }]);
	});

	it('cancelled before any content: nothing persisted, no error frame, no failure — just closed', async () => {
		const { writer, writes } = makeWriter();
		const cancel = cancellation();
		const afterText = vi.fn(async () => {});
		const onCancellation = vi.fn();
		const { hooks, failures } = makeHooks({ signal: cancel.signal, onCancellation });

		await streamTextIntoOpenMessage(writer, only(abortedResult([{ type: 'start-step' }], cancel)), afterText, hooks);

		expect(writes).toEqual([{ type: 'start-step' }, { type: 'finish' }]);
		expect(afterText).not.toHaveBeenCalled();
		expect(failures).toEqual([]);
		expect(onCancellation).toHaveBeenCalledWith({ providerId: 'groq', contentParts: 0 });
	});

	it('cancelled before the first attempt runs no model call at all', async () => {
		const { writer, writes } = makeWriter();
		const cancel = cancellation();
		cancel.abort();
		const run = vi.fn(() => makeResult({ parts: [] }));
		const onCancellation = vi.fn();
		const { hooks } = makeHooks({ signal: cancel.signal, onCancellation });

		await streamTextIntoOpenMessage(writer, [{ providerId: 'google', modelId: 'm', run }], async () => {}, hooks);

		expect(run).not.toHaveBeenCalled();
		expect(writes).toEqual([{ type: 'finish' }]);
		expect(onCancellation).toHaveBeenCalledWith({ providerId: 'google', contentParts: 0 });
	});

	it('a failure on a cancelled turn is still reported once (a 429 still cools) but never rotates or errors', async () => {
		const { writer, writes } = makeWriter();
		const cancel = cancellation();
		const boom = rateLimited();
		const secondary = vi.fn(() => makeResult({ parts: [] }));
		const onCancellation = vi.fn();
		const { hooks, failures } = makeHooks({ signal: cancel.signal, onCancellation });

		await streamTextIntoOpenMessage(
			writer,
			[
				{
					providerId: 'google',
					modelId: 'm',
					// The client leaves while the attempt is in flight; the provider then refuses it.
					run: () => makeResult({ parts: [], failWith: boom, onStream: () => cancel.abort() }),
				},
				{ providerId: 'groq', modelId: 'm', run: secondary },
			],
			async () => {},
			hooks,
		);

		expect(failures).toEqual([{ providerId: 'google', error: boom, willRetry: false }]);
		expect(secondary).not.toHaveBeenCalled();
		expect(writes).toEqual([{ type: 'finish' }]);
		expect(onCancellation).toHaveBeenCalledTimes(1);
	});

	it("an abort nobody asked for is the attempt's deadline: a timeout failure that rotates before content", async () => {
		const { writer, writes } = makeWriter();
		const cancel = cancellation(); // never aborted
		const secondary = vi.fn(() => makeResult({ parts: [{ type: 'text-delta', delta: 'from groq' }] }));
		const { hooks, failures } = makeHooks({ signal: cancel.signal });

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'google', modelId: 'm', run: () => abortedResult([{ type: 'start-step' }]) },
				{ providerId: 'groq', modelId: 'm', run: secondary },
			],
			async () => {},
			hooks,
		);

		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({ providerId: 'google', willRetry: true });
		expect((failures[0].error as AiError).kind).toBe('timeout');
		expect(writes.map((w) => w.type)).toEqual(['start-step', 'text-delta', 'finish']);
	});

	it("the attempt's deadline after content: turnError timeout, the streamed text persisted, one finish", async () => {
		const { writer, writes } = makeWriter();
		const { hooks, failures } = makeHooks({ signal: cancellation().signal });
		const persisted: string[] = [];

		await streamTextIntoOpenMessage(
			writer,
			only(abortedResult([{ type: 'text-delta', delta: 'The catalog has' }])),
			async (text) => {
				persisted.push(text);
			},
			hooks,
		);

		expect(writes).toEqual([
			{ type: 'text-delta', delta: 'The catalog has' },
			{
				type: 'message-metadata',
				messageMetadata: { turnError: { kind: 'timeout', message: expect.any(String) } },
			},
			{ type: 'finish' },
		]);
		expect(persisted).toEqual(['The catalog has']);
		expect(failures[0]).toMatchObject({ providerId: 'groq', willRetry: false });
	});

	it("persists the CURRENT step's text on an abort — never a finished tool step's", async () => {
		const { writer } = makeWriter();
		const cancel = cancellation();
		const persisted: string[] = [];
		const { hooks } = makeHooks({ signal: cancel.signal });

		await streamTextIntoOpenMessage(
			writer,
			only(
				abortedResult(
					[
						{ type: 'start-step' },
						{ type: 'text-delta', delta: 'Let me search.' },
						{ type: 'finish-step' },
						{ type: 'start-step' },
						{ type: 'text-delta', delta: 'The auth showcase' },
					],
					cancel,
				),
			),
			async (text) => {
				persisted.push(text);
			},
			hooks,
		);

		expect(persisted).toEqual(['The auth showcase']);
	});

	// skip (circuit breaker)

	it('never runs a skipped attempt', async () => {
		const { writer, writes } = makeWriter();
		const cooled = vi.fn(() => makeResult({ parts: [{ type: 'text-delta', delta: 'cooled' }] }));
		const live = makeResult({ parts: [{ type: 'text-delta', delta: 'live' }] });
		const { hooks, started } = makeHooks({
			isSkipped: async (id: string | null) => id === 'groq',
		});

		await streamTextIntoOpenMessage(
			writer,
			[
				{ providerId: 'groq', modelId: 'm-groq', run: cooled },
				{ providerId: 'openai', modelId: 'm-openai', run: () => live },
			],
			async () => {},
			hooks,
		);

		expect(cooled).not.toHaveBeenCalled();
		expect(started).toEqual(['openai']);
		expect(writes.map((w) => w.type)).toEqual(['text-delta', 'finish']);
	});

	it('does not mark willRetry when every remaining attempt is skipped', async () => {
		const { writer } = makeWriter();
		const boom = rateLimited();
		const primary = makeResult({ parts: [], failWith: boom });
		const cooled = vi.fn(() => makeResult({ parts: [] }));
		const { hooks, failures } = makeHooks({
			isSkipped: async (id: string | null) => id === 'openai',
		});

		await expect(
			streamTextIntoOpenMessage(
				writer,
				[
					{ providerId: 'groq', modelId: 'm-groq', run: () => primary },
					{ providerId: 'openai', modelId: 'm-openai', run: cooled },
				],
				async () => {},
				hooks,
			),
		).rejects.toBe(boom);

		expect(cooled).not.toHaveBeenCalled();
		expect(failures[0].willRetry).toBe(false);
	});

	it('throws when every attempt is skipped (nothing written to the open message)', async () => {
		const { writer, writes } = makeWriter();
		const { hooks, failures } = makeHooks({ isSkipped: async () => true });

		await expect(
			streamTextIntoOpenMessage(
				writer,
				[{ providerId: 'groq', modelId: 'm-groq', run: () => makeResult({ parts: [] }) }],
				async () => {},
				hooks,
			),
		).rejects.toThrow(/No AI provider was eligible/);

		expect(writes).toHaveLength(0);
		expect(failures).toHaveLength(0);
	});

	// afterText is best-effort, generation failure is not

	it('still closes with a single finish when afterText itself fails', async () => {
		const { writer, writes } = makeWriter();
		const result = makeResult({ parts: [{ type: 'text-start' }] });
		const { hooks } = makeHooks();

		await streamTextIntoOpenMessage(
			writer,
			only(result),
			async () => {
				throw new Error('citation verify exploded');
			},
			hooks,
		);

		expect(writes.map((w) => w.type)).toEqual(['text-start', 'finish']);
	});

	it('does not run afterText or write finish when a content-less attempt is the final failure', async () => {
		const { writer, writes } = makeWriter();
		const result = makeResult({ parts: [{ type: 'start-step' }], failWith: rateLimited() });
		const { hooks } = makeHooks();
		let afterRan = false;

		await expect(
			streamTextIntoOpenMessage(
				writer,
				only(result),
				async () => {
					afterRan = true;
				},
				hooks,
			),
		).rejects.toThrow();

		expect(afterRan).toBe(false);
		expect(writes.map((w) => w.type)).toEqual(['start-step']);
	});
});

/**
 * The same contract against the real SDK — `streamText` over `MockLanguageModelV3` inside a real
 * `createUIMessageStream`, read back as the frames the client would receive. The fakes above
 * model the SDK's failure shape; these prove the shape is what the SDK actually produces.
 */
describe('streamTextIntoOpenMessage against the real SDK', () => {
	type StreamPart =
		Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer P> ? P : never;

	const usage = {
		inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
		outputTokens: { total: 5, text: 5, reasoning: undefined },
		raw: undefined,
	};

	const quota429 = () =>
		new APICallError({
			message: 'You exceeded your current quota, please check your plan and billing details. Retry in 33.5s.',
			url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:streamGenerateContent',
			requestBodyValues: {},
			statusCode: 429,
			isRetryable: true,
		});

	/** A provider whose transport fails before any token. */
	const refusing = () => new MockLanguageModelV3({ doStream: async () => Promise.reject(quota429()) });

	/** A provider that answers. */
	const answering = (text: string) =>
		new MockLanguageModelV3({
			doStream: async () => ({
				stream: simulateReadableStream<StreamPart>({
					chunks: [
						{ type: 'stream-start', warnings: [] },
						{ type: 'text-start', id: 't' },
						{ type: 'text-delta', id: 't', delta: text },
						{ type: 'text-end', id: 't' },
						{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
					],
				}),
			}),
		});

	/** A provider whose transport is cut after the first token: the queued chunks are read, then
	 * the stream errors (`pull` runs once the consumer has drained what `start` enqueued). The SDK
	 * surfaces this as a rejection of the UI stream — no `error` part — and `result.text` never
	 * settles, which is why the helper must not await it once the pump has failed. */
	const cutMidAnswer = () =>
		new MockLanguageModelV3({
			doStream: async () => ({
				stream: new ReadableStream<StreamPart>({
					start(controller) {
						controller.enqueue({ type: 'stream-start', warnings: [] });
						controller.enqueue({ type: 'text-start', id: 't' });
						controller.enqueue({ type: 'text-delta', id: 't', delta: 'The catalog has' });
					},
					pull(controller) {
						controller.error(quota429());
					},
				}),
			}),
		});

	/** A provider that streams one token and then holds the connection open until the call's
	 * `abortSignal` fires — a real provider fetch fails the same way (AbortError) when aborted. */
	const holding = (text: string) =>
		new MockLanguageModelV3({
			doStream: async ({ abortSignal }) => ({
				stream: new ReadableStream<StreamPart>({
					start(controller) {
						controller.enqueue({ type: 'stream-start', warnings: [] });
						controller.enqueue({ type: 'text-start', id: 't' });
						controller.enqueue({ type: 'text-delta', id: 't', delta: text });
						abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
					},
				}),
			}),
		});

	const attempt = (providerId: string, model: MockLanguageModelV3, abortSignal?: AbortSignal): TurnAttempt => ({
		providerId,
		modelId: model.modelId,
		// `onError` silenced: the SDK's default logs every provider error to the console.
		run: () => streamText({ model, prompt: 'hi', maxRetries: 0, abortSignal, onError: () => {} }),
	});

	/** Run the helper the way the orchestrator does and collect every frame the client would get. */
	async function frames(
		attempts: TurnAttempt[],
		hooks = makeHooks(),
		options: { onWrite?: (part: Part) => void; afterText?: (text: string) => void } = {},
	) {
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				writer.write({ type: 'start', messageId: 'm-1' });
				const observed: UIMessageStreamWriter = {
					...writer,
					write: (part) => {
						writer.write(part);
						options.onWrite?.(part as Part);
					},
				};
				await streamTextIntoOpenMessage(
					observed,
					attempts,
					async (text) => {
						options.afterText?.(text);
					},
					hooks.hooks,
				);
			},
			onError: aiErrorFrameText,
		});
		const out: Part[] = [];
		const reader = stream.getReader();
		for (let next = await reader.read(); !next.done; next = await reader.read()) out.push(next.value as Part);
		return { frames: out, ...hooks };
	}

	it('a 429 before any token rotates to the second provider, whose answer is the first thing the client sees', async () => {
		const { frames: out, failures } = await frames([
			attempt('google', refusing()),
			attempt('groq', answering('Hello.')),
		]);

		expect(out.map((f) => f.type)).toEqual([
			'start',
			'start-step',
			'text-start',
			'text-delta',
			'text-end',
			'finish-step',
			'finish',
		]);
		expect(out.find((f) => f.type === 'text-delta')).toMatchObject({ delta: 'Hello.' });
		// The hook got the provider's own error (status 429), not "No output generated".
		expect(failures).toHaveLength(1);
		expect(failures[0].willRetry).toBe(true);
		expect(APICallError.isInstance(failures[0].error)).toBe(true);
		expect((failures[0].error as APICallError).statusCode).toBe(429);
	});

	it('a 429 before any token with no fallback ends in exactly one classified error frame — never the provider prose', async () => {
		const { frames: out, failures } = await frames([attempt('google', refusing())]);

		expect(out.map((f) => f.type)).toEqual(['start', 'error']);
		expect(out[1]).toEqual({
			type: 'error',
			errorText: '[rate_limit] The AI provider is over its limit right now. Please try again in a minute.',
		});
		expect(JSON.stringify(out)).not.toContain('quota');
		expect(failures).toEqual([{ providerId: 'google', error: expect.any(APICallError), willRetry: false }]);
	});

	it('a stream cut after text closes the message with turnError — no error frame, no rotation', async () => {
		const secondary = vi.fn(() => answering('dupe'));
		const { frames: out, failures } = await frames([
			attempt('google', cutMidAnswer()),
			{
				providerId: 'groq',
				modelId: 'm',
				run: () => streamText({ model: secondary(), prompt: 'hi', onError: () => {} }),
			},
		]);

		expect(out.map((f) => f.type)).toEqual([
			'start',
			'start-step',
			'text-start',
			'text-delta',
			'message-metadata',
			'finish',
		]);
		expect(out.find((f) => f.type === 'text-delta')).toMatchObject({ delta: 'The catalog has' });
		expect(out[4]).toEqual({
			type: 'message-metadata',
			messageMetadata: {
				turnError: {
					kind: 'rate_limit',
					message: 'The AI provider is over its limit right now. Please try again in a minute.',
				},
			},
		});
		expect(secondary).not.toHaveBeenCalled();
		expect(failures).toEqual([{ providerId: 'google', error: expect.any(APICallError), willRetry: false }]);
	});

	it('Stop mid-answer aborts the model call and persists what streamed — no failure, no rotation', async () => {
		const cancel = new AbortController();
		const secondary = vi.fn(() => answering('dupe'));
		const onCancellation = vi.fn();
		const persisted: string[] = [];
		const { frames: out, failures } = await frames(
			[
				attempt('google', holding('Half an answer'), AbortSignal.any([cancel.signal, AbortSignal.timeout(5_000)])),
				{ providerId: 'groq', modelId: 'm', run: () => streamText({ model: secondary(), prompt: 'hi' }) },
			],
			makeHooks({ signal: cancel.signal, onCancellation }),
			{
				// The client hits Stop once the first token has reached it.
				onWrite: (part) => {
					if (part.type === 'text-delta') cancel.abort();
				},
				afterText: (text) => persisted.push(text),
			},
		);

		expect(out.map((f) => f.type)).toEqual(['start', 'start-step', 'text-start', 'text-delta', 'finish']);
		expect(persisted).toEqual(['Half an answer']);
		expect(failures).toEqual([]);
		expect(secondary).not.toHaveBeenCalled();
		expect(onCancellation).toHaveBeenCalledWith({ providerId: 'google', contentParts: 2 });
	});

	it("the attempt's own deadline mid-answer closes the message with turnError timeout and persists the text", async () => {
		const persisted: string[] = [];
		const { frames: out, failures } = await frames(
			[attempt('google', holding('The catalog has'), AbortSignal.timeout(30))],
			makeHooks({ signal: new AbortController().signal }),
			{ afterText: (text) => persisted.push(text) },
		);

		expect(out.map((f) => f.type)).toEqual([
			'start',
			'start-step',
			'text-start',
			'text-delta',
			'message-metadata',
			'finish',
		]);
		expect(out[4]).toMatchObject({ messageMetadata: { turnError: { kind: 'timeout' } } });
		expect(persisted).toEqual(['The catalog has']);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({ providerId: 'google', willRetry: false });
	});
});
