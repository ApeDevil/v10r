/**
 * The recorder's contract: the shape it hands the client (every key present, no bodies),
 * how it joins what the middleware, the step hooks and the tool hooks each see into one
 * model-call record, the caps and compaction facts on tool executions, and that it writes
 * the trace once, never throwing into the answer.
 */

import type { ModelMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveTurnTrace = vi.fn();
vi.mock('$lib/server/db/ai/mutations', () => ({ saveTurnTrace: (...args: unknown[]) => saveTurnTrace(...args) }));

const { createTurnRecorder, outlineHistory, TOOL_RESULT_CAP_CHARS } = await import('./recorder');

const recorderFor = () =>
	createTurnRecorder({
		conversationId: 'conv-1',
		messageId: 'msg-1',
		surface: 'chatbot',
		requestId: 'req-1',
		userId: 'user-1',
		t0: performance.now(),
	});

beforeEach(() => {
	saveTurnTrace.mockReset().mockResolvedValue(undefined);
});

describe('snapshot', () => {
	it('carries every key of the trace, with block text, tool I/O and tool definitions withheld', () => {
		const recorder = recorderFor();
		recorder.block({ id: 'role', section: 'identity', text: 'You are Vely.', stable: true });
		recorder.toolsOffered({ search_catalog: { description: 'Find a page' } } as never);
		recorder.tool({ toolCallId: 'c1', toolName: 'search_catalog', input: { query: 'auth' }, output: { rows: [] } });

		const snapshot = recorder.snapshot();
		expect(Object.keys(snapshot).sort()).toEqual(
			[
				'activations',
				'attempts',
				'awareness',
				'blocks',
				'bodies',
				'citations',
				'conversationId',
				'errorKind',
				'grounding',
				'history',
				'messageId',
				'modelCalls',
				'outcome',
				'profileVersion',
				'proposalId',
				'requestId',
				'surface',
				'timings',
				'toolExecutions',
			].sort(),
		);
		expect(snapshot.bodies).toBe('persisted');
		expect(snapshot.blocks).toEqual([{ id: 'role', section: 'identity', chars: 13, stable: true }]);
		expect(snapshot.toolExecutions[0]).not.toHaveProperty('input');
		expect(snapshot.toolExecutions[0]).not.toHaveProperty('output');
		expect(snapshot).not.toHaveProperty('toolset');
		// The full trace keeps them.
		const trace = recorder.trace();
		expect(trace.blocks[0].text).toBe('You are Vely.');
		expect(trace.toolExecutions[0].output).toEqual({ rows: [] });
		expect(trace.toolset).toEqual([{ name: 'search_catalog', description: 'Find a page', inputSchema: null }]);
	});

	it('notifies its subscriber on every change', () => {
		const recorder = recorderFor();
		const listener = vi.fn();
		recorder.subscribe(listener);
		recorder.activation('project-docs', true);
		recorder.timing({ preStreamMs: 3 });
		expect(listener).toHaveBeenCalledTimes(2);
	});
});

describe('model calls', () => {
	it('joins the middleware’s request with the step hook’s response, in order, per attempt', () => {
		const recorder = recorderFor();
		recorder.attemptStart({ providerId: 'google', modelId: 'gemini' });
		const request = {
			systemHash: 'sys:1',
			blockIds: ['role' as const],
			historyCount: 1,
			toolsOffered: ['search_catalog'],
		};
		recorder.callStart({
			request,
			toolset: [{ name: 'search_catalog', description: 'Find', inputSchema: { type: 'object' } }],
		});
		recorder.firstToken();
		recorder.tool({ toolCallId: 'c1', toolName: 'search_catalog', input: {}, output: {}, durationMs: 5 });
		recorder.callEnd({
			usage: { inputTokens: 10, outputTokens: 4, inputTokenDetails: { cacheReadTokens: 6 } } as never,
			finishReason: 'tool-calls',
			responseId: 'resp-1',
			toolCalls: [{ toolCallId: 'c1', toolName: 'search_catalog' }],
		});
		recorder.callStart({ request: { ...request, toolsOffered: [] } });
		recorder.callEnd({ usage: { inputTokens: 20, outputTokens: 8 } as never, finishReason: 'stop', textChars: 30 });
		recorder.attemptEnd('ok');

		const { modelCalls, toolExecutions, toolset, attempts } = recorder.trace();
		expect(modelCalls.map((c) => [c.attemptIndex, c.stepIndex, c.request.toolsOffered.length])).toEqual([
			[0, 0, 1],
			[0, 1, 0],
		]);
		expect(modelCalls[0].response).toMatchObject({
			finishReason: 'tool-calls',
			responseId: 'resp-1',
			cacheReadTokens: 6,
			firstTokenMs: expect.any(Number),
			toolCalls: [{ toolCallId: 'c1', toolName: 'search_catalog' }],
		});
		expect(modelCalls[0].inputTokens).toBe(10);
		expect(modelCalls[1].response?.textChars).toBe(30);
		// The execution belongs to the call that asked for it.
		expect(toolExecutions[0].modelCallId).toBe(modelCalls[0].id);
		// Definitions as sent replace the names-only placeholder.
		expect(toolset[0].inputSchema).toEqual({ type: 'object' });
		expect(attempts).toEqual([{ attemptIndex: 0, providerId: 'google', modelId: 'gemini', outcome: 'ok' }]);
	});

	it('opens the call itself when no middleware reported the request', () => {
		const recorder = recorderFor();
		recorder.attemptStart({ providerId: 'groq', modelId: 'gpt-oss' });
		recorder.toolsOffered({ a: {}, b: {} } as never);
		recorder.callEnd({ stepIndex: 0, usage: { inputTokens: 1, outputTokens: 1 } as never });
		const [call] = recorder.trace().modelCalls;
		expect(call).toMatchObject({ providerId: 'groq', modelId: 'gpt-oss', stepIndex: 0, inputTokens: 1 });
		expect(call.request).toEqual({ systemHash: '', blockIds: [], historyCount: 0, toolsOffered: ['a', 'b'] });
	});

	it('closes an open call as an error when its attempt fails, and moves on to the next attempt', () => {
		const recorder = recorderFor();
		recorder.attemptStart({ providerId: 'google', modelId: 'gemini' });
		recorder.callStart({ request: { systemHash: 'sys:1', blockIds: [], historyCount: 1, toolsOffered: [] } });
		recorder.attemptEnd('rotated', { errorKind: 'rate_limit' });
		recorder.attemptStart({ providerId: 'groq', modelId: 'gpt-oss' });
		recorder.callStart({ request: { systemHash: 'sys:1', blockIds: [], historyCount: 1, toolsOffered: [] } });
		recorder.callEnd({ usage: { inputTokens: 1, outputTokens: 1 } as never });

		const { modelCalls, attempts } = recorder.trace();
		expect(modelCalls.map((c) => [c.attemptIndex, c.stepIndex, c.outcome, c.providerId])).toEqual([
			[0, 0, 'error', 'google'],
			[1, 0, 'ok', 'groq'],
		]);
		expect(attempts[0]).toMatchObject({ outcome: 'rotated', errorKind: 'rate_limit' });
	});
});

describe('tool executions', () => {
	it('merges the hook’s timing with the step loop’s status by tool call id, in execution order', () => {
		const recorder = recorderFor();
		recorder.tool({ toolCallId: 'c1', toolName: 'desk_update_cells', input: { a: 1 }, durationMs: 7.6 });
		recorder.tool({ toolCallId: 'c2', toolName: 'desk_read_file', input: {}, durationMs: 2 });
		recorder.tool({
			toolCallId: 'c1',
			toolName: 'desk_update_cells',
			output: { requiresApproval: true },
			status: 'requires_approval',
		});
		const [first, second] = recorder.trace().toolExecutions;
		expect(first).toMatchObject({
			ordinal: 0,
			durationMs: 8,
			status: 'requires_approval',
			output: { requiresApproval: true },
		});
		expect(second).toMatchObject({ ordinal: 1, toolName: 'desk_read_file' });
	});

	it('caps an oversized model-facing result to a preview and records a compaction when one was reported', () => {
		const recorder = recorderFor();
		recorder.compacted('search_project_docs', { ref: 'tr_search_project_docs_0', originalBytes: 9000 });
		recorder.tool({
			toolCallId: 'c1',
			toolName: 'search_project_docs',
			output: { ref: 'tr_search_project_docs_0', summary: 'x', truncated: true, originalBytes: 9000, hint: '' },
		});
		recorder.tool({
			toolCallId: 'c2',
			toolName: 'resolve_ref',
			output: { text: 'y'.repeat(TOOL_RESULT_CAP_CHARS + 100) },
		});
		const [compacted, resolved] = recorder.trace().toolExecutions;
		expect(compacted.compaction).toEqual({ ref: 'tr_search_project_docs_0', originalBytes: 9000 });
		expect(resolved.output).toMatchObject({ capped: true, chars: expect.any(Number) });
		expect((resolved.output as { preview: string }).preview.length).toBe(TOOL_RESULT_CAP_CHARS);
	});
});

describe('citations and grounding', () => {
	it('marks the cited items on their sources', () => {
		const recorder = recorderFor();
		recorder.grounding({
			id: 'catalog',
			ran: true,
			items: [
				{ id: 'a', kind: 'catalog', title: 'A', rank: 0, state: 'included' },
				{ id: 'b', kind: 'catalog', title: 'B', rank: 1, state: 'included' },
			],
		});
		recorder.citations([{ itemId: 'b', source: 'catalog', match: 'path', path: '/b' }]);
		expect(recorder.trace().grounding[0].items.map((i) => i.state)).toEqual(['included', 'cited']);
	});

	it('keeps a tool-surfaced item’s call and place through the snapshot, and cites it in place', () => {
		const recorder = recorderFor();
		recorder.grounding({
			id: 'project-docs',
			ran: true,
			retrievers: ['tier-1'],
			items: [
				{
					id: 'chunk_a',
					kind: 'chunk',
					title: 'A',
					rank: 0,
					state: 'executed',
					toolCallId: 'call_1',
					parentId: 'parent_a',
					level: 'paragraph',
					position: 2,
					contentHash: 'abc',
					retriever: 'tier-1',
					body: 'the body',
				},
			],
		});
		const snapshot = recorder.snapshot().grounding[0];
		expect(snapshot.retrievers).toEqual(['tier-1']);
		expect(snapshot.items[0]).toMatchObject({
			state: 'executed',
			toolCallId: 'call_1',
			parentId: 'parent_a',
			level: 'paragraph',
			position: 2,
			contentHash: 'abc',
			retriever: 'tier-1',
		});
		expect(snapshot.items[0]).not.toHaveProperty('body');
		recorder.citations([{ itemId: 'chunk_a', source: 'project-docs', match: 'path', path: '/a' }]);
		expect(recorder.trace().grounding[0].items[0]).toMatchObject({ state: 'cited', toolCallId: 'call_1' });
	});

	it('replaces a source recorded twice rather than appending it', () => {
		const recorder = recorderFor();
		recorder.grounding({ id: 'project-docs', ran: false, skippedReason: 'gated_off', items: [] });
		recorder.grounding({ id: 'project-docs', ran: true, items: [] });
		expect(recorder.trace().grounding).toEqual([{ id: 'project-docs', ran: true, items: [] }]);
	});
});

describe('history outline', () => {
	it('sizes every part and names compacted tool results by their ref, never quoting text', () => {
		const messages = [
			{ role: 'user', content: 'How does auth work?' },
			{
				role: 'assistant',
				content: [
					{ type: 'text', text: 'Let me look.' },
					{ type: 'tool-call', toolCallId: 'c1', toolName: 'search_catalog', input: { query: 'auth' } },
				],
			},
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'c1',
						toolName: 'search_catalog',
						output: { type: 'json', value: { ref: 'tr_search_catalog_0', truncated: true, originalBytes: 5000 } },
					},
				],
			},
		] as unknown as ModelMessage[];
		const outline = outlineHistory(messages, 2);
		expect(outline.droppedMessages).toBe(2);
		expect(outline.messages).toEqual([
			{ role: 'user', parts: [{ type: 'text', chars: 19 }] },
			{
				role: 'assistant',
				parts: [
					{ type: 'text', chars: 12 },
					{ type: 'tool_call', toolName: 'search_catalog', chars: expect.any(Number) },
				],
			},
			{
				role: 'tool',
				parts: [
					{ type: 'compaction', toolName: 'search_catalog', chars: expect.any(Number), ref: 'tr_search_catalog_0' },
				],
			},
		]);
		expect(JSON.stringify(outline)).not.toContain('auth work');
	});
});

describe('persist', () => {
	it('writes the trace once, with the profile version hashed from the stable blocks and the tool definitions', async () => {
		const recorder = recorderFor();
		recorder.block({ id: 'role', section: 'identity', text: 'You are Vely.', stable: true });
		recorder.block({ id: 'retrieval-context', section: 'grounding', text: 'chunk body', stable: false });
		recorder.outcome('ok');
		await recorder.persist();
		await recorder.persist();
		expect(saveTurnTrace).toHaveBeenCalledTimes(1);
		const [trace, userId] = saveTurnTrace.mock.calls[0];
		expect(userId).toBe('user-1');
		expect(trace.profileVersion).toMatch(/^sys:/);
		// The dynamic block does not move the profile version.
		const other = recorderFor();
		other.block({ id: 'role', section: 'identity', text: 'You are Vely.', stable: true });
		other.block({ id: 'retrieval-context', section: 'grounding', text: 'a different chunk', stable: false });
		expect(other.trace().profileVersion).toBe(trace.profileVersion);
	});

	it('logs a write failure and resolves — the answer never pays for the trace', async () => {
		saveTurnTrace.mockRejectedValueOnce(new Error('neon down'));
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(recorderFor().persist()).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledWith(expect.stringContaining('persist turn trace'), 'neon down');
		error.mockRestore();
	});
});
