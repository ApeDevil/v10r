import type { LanguageModelUsage, UIMessageStreamWriter } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { AIError } from '$lib/server/ai/errors';
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

function makeResult(opts: {
	parts: Part[];
	text?: string;
	usage?: LanguageModelUsage;
	/** Reject `result.text` (generation failed after the pump drained). */
	rejectText?: boolean;
	/** Throw mid-pump, after yielding `parts`. */
	throwAfterParts?: unknown;
	error?: unknown;
	onStream?: (o: { sendStart: boolean; sendFinish: boolean }) => void;
}): PumpableTextResult {
	const failure = opts.error ?? new AIError('rate_limit', 'quota exceeded', '429');
	return {
		toUIMessageStream(streamOpts: { sendStart: boolean; sendFinish: boolean }) {
			opts.onStream?.(streamOpts);
			return (async function* () {
				for (const p of opts.parts) yield p;
				if (opts.throwAfterParts) throw failure;
			})();
		},
		get text() {
			return opts.rejectText ? Promise.reject(failure) : Promise.resolve(opts.text ?? 'hi');
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

describe('streamTextIntoOpenMessage', () => {
	// ── success path (unchanged contract) ────────────────────────────────────

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
		expect(streamOpts).toEqual({ sendStart: false, sendFinish: false });

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

	// ── rotation ─────────────────────────────────────────────────────────────

	it('rotates to the next provider when the primary fails with ZERO visible parts', async () => {
		const { writer, writes } = makeWriter();
		const primary = makeResult({ parts: [], rejectText: true });
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

		// Second provider's parts pumped into the SAME open message; exactly one finish.
		expect(writes.map((w) => w.type)).toEqual(['text-start', 'text-delta', 'finish']);
		expect(afterTextCalls).toBe(1);
		expect(started).toEqual(['groq', 'openai']);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({ providerId: 'groq', willRetry: true });
	});

	it('rotates on a mid-pump throw only while zero parts have been emitted', async () => {
		const { writer, writes } = makeWriter();
		const primary = makeResult({ parts: [], throwAfterParts: true });
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

	// ── no rotation once the client has seen frames ──────────────────────────

	it('does NOT rotate after a visible part — rethrows and writes NO finish', async () => {
		const { writer, writes } = makeWriter();
		const boom = new AIError('rate_limit', 'quota exceeded', '429');
		const primary = makeResult({ parts: [{ type: 'text-delta', delta: 'partial' }], rejectText: true, error: boom });
		const secondary = vi.fn(() => makeResult({ parts: [{ type: 'text-delta', delta: 'dupe' }] }));
		const { hooks, failures } = makeHooks();
		let afterTextCalls = 0;

		await expect(
			streamTextIntoOpenMessage(
				writer,
				[
					{ providerId: 'groq', modelId: 'm-groq', run: () => primary },
					{ providerId: 'openai', modelId: 'm-openai', run: secondary },
				],
				async () => {
					afterTextCalls++;
				},
				hooks,
			),
		).rejects.toBe(boom);

		// The partial text stays, the fallback never runs (it would duplicate it), no finish frame.
		expect(writes.map((w) => w.type)).toEqual(['text-delta']);
		expect(secondary).not.toHaveBeenCalled();
		expect(afterTextCalls).toBe(0);
		expect(failures).toHaveLength(1);
		expect(failures[0].willRetry).toBe(false);
	});

	// ── non-retryable kinds ──────────────────────────────────────────────────

	it("rethrows immediately on kind 'unknown' even with attempts remaining", async () => {
		const { writer, writes } = makeWriter();
		const boom = new AIError('unknown', 'tool schema is malformed');
		const primary = makeResult({ parts: [], rejectText: true, error: boom });
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
		expect(writes).toHaveLength(0);
		expect(failures[0].willRetry).toBe(false);
	});

	// ── skip (circuit breaker) ───────────────────────────────────────────────

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
		const boom = new AIError('rate_limit', 'quota exceeded', '429');
		const primary = makeResult({ parts: [], rejectText: true, error: boom });
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

	// ── afterText is best-effort, generation failure is not ──────────────────

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

	it('no longer swallows generation failure: afterText skipped, no finish, error propagates', async () => {
		const { writer, writes } = makeWriter();
		const result = makeResult({ parts: [{ type: 'text-start' }], rejectText: true });
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
		expect(writes.map((w) => w.type)).toEqual(['text-start']);
	});
});
