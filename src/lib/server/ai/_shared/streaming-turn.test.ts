import type { LanguageModelUsage, UIMessageStreamWriter } from 'ai';
import { describe, expect, it } from 'vitest';
import { type PumpableTextResult, streamTextIntoOpenMessage } from './streaming-turn';

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
	rejectText?: boolean;
	onStream?: (o: { sendStart: boolean; sendFinish: boolean }) => void;
}): PumpableTextResult {
	return {
		toUIMessageStream(streamOpts: { sendStart: boolean; sendFinish: boolean }) {
			opts.onStream?.(streamOpts);
			return (async function* () {
				for (const p of opts.parts) yield p;
			})();
		},
		get text() {
			return opts.rejectText ? Promise.reject(new Error('gen failed')) : Promise.resolve(opts.text ?? 'hi');
		},
		get totalUsage() {
			return Promise.resolve(opts.usage ?? USAGE);
		},
	} as unknown as PumpableTextResult;
}

describe('streamTextIntoOpenMessage', () => {
	it('writes text parts → afterText metadata → exactly one finish, with NO metadata after finish', async () => {
		const { rec, writer, writes } = makeWriter();
		let streamOpts: { sendStart: boolean; sendFinish: boolean } | null = null;
		const result = makeResult({
			parts: [{ type: 'text-start' }, { type: 'text-delta', delta: 'hi' }, { type: 'text-end' }],
			onStream: (o) => {
				streamOpts = o;
			},
		});

		await streamTextIntoOpenMessage(writer, result, async () => {
			// Simulate the late citation/catalog flush.
			rec.write({ type: 'message-metadata', messageMetadata: { pipeline: ['done'] } });
		});

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

		await streamTextIntoOpenMessage(writer, result, async (text, usage) => {
			seen.text = text;
			seen.usage = usage;
		});

		expect(seen.text).toBe('the answer');
		expect(seen.usage?.inputTokens).toBe(7);
	});

	it('still closes with a single finish when generation fails (afterText skipped)', async () => {
		const { writer, writes } = makeWriter();
		let afterRan = false;
		const result = makeResult({ parts: [{ type: 'text-start' }], rejectText: true });

		await streamTextIntoOpenMessage(writer, result, async () => {
			afterRan = true;
		});

		expect(afterRan).toBe(false);
		expect(writes.map((w) => w.type)).toEqual(['text-start', 'finish']);
	});
});
