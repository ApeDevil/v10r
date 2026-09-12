/**
 * The last allowed step answers — proved against the real `streamText` loop, not a mock of
 * it: a model that calls a tool whenever it is offered one would otherwise end a 3-step
 * budget on an unanswered tool call (observed live as a dangling third `search_catalog`).
 */
import { jsonSchema, stepCountIs, streamText, tool } from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { answerOnLastStep } from './step-budget';

/** The provider-level stream part, as the mock model's own `doStream` types it. */
type StreamPart =
	Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer Part> ? Part : never;

const usage = {
	inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 5, text: 5, reasoning: undefined },
	raw: undefined,
};

/** Calls `lookup` whenever the step offers it; answers in text only when no tool is offered. */
function toolHungryModel() {
	let call = 0;
	return new MockLanguageModelV3({
		doStream: async ({ tools }) => {
			const chunks: StreamPart[] = [{ type: 'stream-start', warnings: [] }];
			if (tools?.length) {
				chunks.push(
					{ type: 'tool-call', toolCallId: `call-${call++}`, toolName: 'lookup', input: '{}' },
					{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage },
				);
			} else {
				chunks.push(
					{ type: 'text-start', id: 't' },
					{ type: 'text-delta', id: 't', delta: 'Here is the answer.' },
					{ type: 'text-end', id: 't' },
					{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
				);
			}
			return { stream: simulateReadableStream({ chunks }) };
		},
	});
}

const tools = {
	lookup: tool({
		description: 'look something up',
		inputSchema: jsonSchema<Record<string, never>>({ type: 'object', properties: {} }),
		execute: async () => ({ found: true }),
	}),
};

describe('answerOnLastStep', () => {
	it('withholds the tools on the last allowed step and lets every earlier step keep them', () => {
		const prepare = answerOnLastStep(3);
		expect(prepare({ stepNumber: 0 })).toBeUndefined();
		expect(prepare({ stepNumber: 1 })).toBeUndefined();
		expect(prepare({ stepNumber: 2 })).toEqual({ activeTools: [] });
	});

	it('ends a 3-step budget in text with no unanswered tool call', async () => {
		const result = streamText({
			model: toolHungryModel(),
			prompt: 'find it',
			tools,
			stopWhen: stepCountIs(3),
			prepareStep: answerOnLastStep(3),
		});
		await result.consumeStream();
		const steps = await result.steps;

		expect(steps).toHaveLength(3);
		expect(steps.slice(0, 2).every((s) => s.toolCalls.length === 1)).toBe(true);
		const last = steps[2];
		expect(last.toolCalls).toEqual([]);
		expect(last.text).toBe('Here is the answer.');
		expect(await result.text).toBe('Here is the answer.');
	});

	it('without the policy, the same budget ends on a tool call and no answer (the defect)', async () => {
		const result = streamText({ model: toolHungryModel(), prompt: 'find it', tools, stopWhen: stepCountIs(3) });
		await result.consumeStream();
		const steps = await result.steps;

		expect(steps).toHaveLength(3);
		expect(steps[2].toolCalls).toHaveLength(1);
		expect(await result.text).toBe('');
	});
});
