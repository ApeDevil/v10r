import { describe, expect, it } from 'vitest';
import { createToolLeakGuard, stripTextualToolCall } from './tool-leak-guard';

describe('stripTextualToolCall', () => {
	it('blanks a turn that is entirely a textual tool-call leak', () => {
		expect(stripTextualToolCall('<function=search_catalog>{"query": "Button component"}')).toBe('');
		expect(stripTextualToolCall('<function(search_catalog)>{"query": "x"}')).toBe('');
		expect(stripTextualToolCall('<|python_tag|>search_catalog.call()')).toBe('');
		expect(stripTextualToolCall('  \n<tool_call>{"name":"x"}')).toBe('');
	});

	it('is case-insensitive on the marker', () => {
		expect(stripTextualToolCall('<FUNCTION=search_catalog>{}')).toBe('');
	});

	it('leaves a legitimate answer untouched', () => {
		const answer = 'The Button component lives at /showcases/forms.';
		expect(stripTextualToolCall(answer)).toBe(answer);
	});

	it('does not truncate prose that merely mentions <function mid-sentence', () => {
		const answer = 'You can wrap it in a <function> block if you like.';
		expect(stripTextualToolCall(answer)).toBe(answer);
	});
});

/** Drive a list of stream parts through the guard transform and collect output. */
async function run(parts: Array<{ type: string; text?: string }>): Promise<Array<{ type: string; text?: string }>> {
	const transform = createToolLeakGuard()();
	const out: Array<{ type: string; text?: string }> = [];
	const writer = transform.writable.getWriter();
	const reader = transform.readable.getReader();
	const pump = (async () => {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			out.push(value as { type: string; text?: string });
		}
	})();
	for (const p of parts) await writer.write(p);
	await writer.close();
	await pump;
	return out;
}

/** Helper: concatenate the text of all `text-delta` parts. */
const textOf = (parts: Array<{ type: string; text?: string }>) =>
	parts
		.filter((p) => p.type === 'text-delta')
		.map((p) => p.text ?? '')
		.join('');

describe('createToolLeakGuard (stream transform)', () => {
	it('passes a normal answer through unchanged', async () => {
		const out = await run([
			{ type: 'start-step' },
			{ type: 'text-start' },
			{ type: 'text-delta', text: 'The Button ' },
			{ type: 'text-delta', text: 'component lives at /showcases/forms.' },
			{ type: 'text-end' },
			{ type: 'finish-step' },
		]);
		expect(textOf(out)).toBe('The Button component lives at /showcases/forms.');
	});

	it('suppresses a textual tool-call leak streamed across deltas', async () => {
		const out = await run([
			{ type: 'start-step' },
			{ type: 'text-start' },
			{ type: 'text-delta', text: '<func' },
			{ type: 'text-delta', text: 'tion=search_catalog>' },
			{ type: 'text-delta', text: '{"query": "Button component"}' },
			{ type: 'text-end' },
			{ type: 'finish-step' },
		]);
		expect(textOf(out)).toBe('');
	});

	it('always passes non-text parts (tool-call, finish) through', async () => {
		const toolCall = { type: 'tool-call', text: undefined };
		const out = await run([{ type: 'start-step' }, toolCall, { type: 'finish-step' }]);
		expect(out.some((p) => p.type === 'tool-call')).toBe(true);
		expect(out.some((p) => p.type === 'finish-step')).toBe(true);
	});

	it('does not gag legitimate text in a later step after a leak step', async () => {
		const out = await run([
			// Step 1: leak.
			{ type: 'start-step' },
			{ type: 'text-delta', text: '<function=search_catalog>{}' },
			{ type: 'finish-step' },
			// Step 2: real answer.
			{ type: 'start-step' },
			{ type: 'text-delta', text: 'Here is the answer.' },
			{ type: 'finish-step' },
		]);
		expect(textOf(out)).toBe('Here is the answer.');
	});

	it('releases buffered text when a step ends mid-sniff without a leak', async () => {
		const out = await run([
			{ type: 'start-step' },
			// Short, ambiguous prefix that never disambiguates before flush.
			{ type: 'text-delta', text: '<' },
		]);
		expect(textOf(out)).toBe('<');
	});
});
