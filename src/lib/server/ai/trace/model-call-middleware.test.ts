/**
 * The middleware records the request as the provider sees it — system prompt hashed, history
 * counted, tools with their schemas — and touches nothing else: the stream it returns is the
 * provider's own.
 */
import { describe, expect, it, vi } from 'vitest';
import { hashSystemPrompt } from '$lib/server/ai/context/history';
import { type ModelCallOptions, outlineCallOptions, toolDefinitionsOf, traceModelCalls } from './model-call-middleware';
import type { TurnRecorder } from './recorder';

vi.mock('$lib/server/db/ai/mutations', () => ({ saveTurnTrace: vi.fn() }));

const params: ModelCallOptions = {
	prompt: [
		{ role: 'system', content: 'You are Vely.' },
		{ role: 'user', content: [{ type: 'text', text: 'Where is auth?' }] },
		{ role: 'assistant', content: [{ type: 'text', text: 'Looking.' }] },
	],
	tools: [
		{ type: 'function', name: 'search_catalog', description: 'Find a page', inputSchema: { type: 'object' } },
		{ type: 'provider', id: 'google.search', name: 'google_search', args: {} },
	],
	toolChoice: { type: 'auto' },
	providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
};

describe('outlineCallOptions', () => {
	it('hashes the system prompt, counts the history and names the tools — never the text', () => {
		const request = outlineCallOptions(params, ['role', 'catalog-map']);
		expect(request).toEqual({
			systemHash: hashSystemPrompt('You are Vely.'),
			blockIds: ['role', 'catalog-map'],
			historyCount: 2,
			toolResultIds: [],
			toolsOffered: ['search_catalog', 'google_search'],
			toolChoice: 'auto',
			providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
		});
		expect(JSON.stringify(request)).not.toContain('Where is auth');
	});

	it('names the tool results the request carries — the earlier steps’ round trips', () => {
		const second: ModelCallOptions = {
			...params,
			prompt: [
				...params.prompt,
				{
					role: 'assistant',
					content: [
						{ type: 'tool-call', toolCallId: 'call_a', toolName: 'search_catalog', input: { query: 'auth' } },
						{ type: 'tool-call', toolCallId: 'call_b', toolName: 'search_catalog', input: { query: 'login' } },
					],
				},
				{
					role: 'tool',
					content: [
						{
							type: 'tool-result',
							toolCallId: 'call_a',
							toolName: 'search_catalog',
							output: { type: 'json', value: {} },
						},
						{
							type: 'tool-result',
							toolCallId: 'call_b',
							toolName: 'search_catalog',
							output: { type: 'json', value: {} },
						},
					],
				},
			],
		};
		const request = outlineCallOptions(second, []);
		expect(request.toolResultIds).toEqual(['call_a', 'call_b']);
		expect(request.historyCount).toBe(4);
		expect(JSON.stringify(request)).not.toContain('login');
	});

	it('names a forced tool choice by its tool', () => {
		const forced = { ...params, toolChoice: { type: 'tool' as const, toolName: 'search_catalog' } };
		expect(outlineCallOptions(forced, []).toolChoice).toBe('tool:search_catalog');
	});
});

describe('toolDefinitionsOf', () => {
	it('keeps the model-facing description and schema of each function tool', () => {
		expect(toolDefinitionsOf(params)).toEqual([
			{ name: 'search_catalog', description: 'Find a page', inputSchema: { type: 'object' } },
			{ name: 'google_search', description: 'provider tool google.search', inputSchema: {} },
		]);
	});
});

describe('traceModelCalls', () => {
	const recorder = { callStart: vi.fn(() => 'mcl_1') } as unknown as TurnRecorder;

	it('reports each stream call to the recorder and returns the provider’s stream untouched', async () => {
		const stream = new ReadableStream();
		const doStream = vi.fn(async (_options: ModelCallOptions) => ({ stream }));
		const model = {
			specificationVersion: 'v3',
			provider: 'google',
			modelId: 'gemini-2.5-flash',
			supportedUrls: {},
			doGenerate: vi.fn(),
			doStream,
		};
		const wrapped = traceModelCalls(model as never, recorder, { blockIds: () => ['role'] });
		expect(wrapped).not.toBe(model);

		const result = await (wrapped as typeof model).doStream(params as never);
		expect(result.stream).toBe(stream);
		expect(recorder.callStart).toHaveBeenCalledWith({
			request: expect.objectContaining({ blockIds: ['role'], toolsOffered: ['search_catalog', 'google_search'] }),
			toolset: toolDefinitionsOf(params),
		});
	});

	it('leaves a model the SDK cannot wrap alone', () => {
		expect(traceModelCalls('openai/gpt-4o-mini', recorder, { blockIds: () => [] })).toBe('openai/gpt-4o-mini');
		const v2 = { specificationVersion: 'v2' };
		expect(traceModelCalls(v2 as never, recorder, { blockIds: () => [] })).toBe(v2);
	});
});
