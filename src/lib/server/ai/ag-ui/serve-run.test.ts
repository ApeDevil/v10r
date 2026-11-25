/**
 * The stream half of the AG-UI endpoint, on hand-written UI message streams: what it adds to
 * the projection (thread handle, proposal handle, tickets, cancellation, a closed run on a
 * truncated stream) and the cancel door to the orchestrator's body. The whole endpoint, with
 * the real orchestrator and the official client, is `routes/api/ai/ag-ui/deskbot/server.test.ts`.
 */
import { EventSchema } from '@ag-ui/core/schemas';
import type { UIMessageChunk } from 'ai';
import { describe, expect, it } from 'vitest';
import { serveAgUiRun } from './serve-run';
import { checkToolResultTicket } from './tool-result-ticket';
import type { AgUiEvent } from './ui-stream-to-ag-ui';

const run = { threadId: 'thread-1', runId: 'run-1' };

function uiStreamResponse(chunks: UIMessageChunk[], init: { done?: boolean; onCancel?: () => void } = {}) {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
			if (init.done !== false) {
				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			}
		},
		cancel() {
			init.onCancel?.();
		},
	});
	return new Response(body, {
		headers: { 'content-type': 'text/event-stream', 'x-conversation-id': 'conv-1' },
	});
}

async function eventsOf(response: Response): Promise<AgUiEvent[]> {
	const text = await response.text();
	return text
		.split('\n\n')
		.filter((frame) => frame.startsWith('data: '))
		.map((frame) => JSON.parse(frame.slice('data: '.length)) as AgUiEvent);
}

describe('serveAgUiRun', () => {
	it('passes a pre-stream refusal through as the JSON error it is', async () => {
		const refusal = Response.json({ error: { code: 'ai_unavailable' } }, { status: 503 });
		expect(serveAgUiRun(refusal, { run, userId: 'u' })).toBe(refusal);
	});

	it('adds the thread and proposal handles, tickets every result, and stays schema-valid', async () => {
		const response = serveAgUiRun(
			uiStreamResponse([
				{ type: 'start', messageId: 'm1' },
				{ type: 'start-step' },
				{ type: 'tool-input-available', toolCallId: 'c1', toolName: 'desk_rename_file', input: { name: 'x' } },
				{ type: 'tool-output-available', toolCallId: 'c1', output: { requiresApproval: true } },
				{ type: 'finish-step' },
				{
					type: 'message-metadata',
					messageMetadata: { harness: { proposal: { id: 'prp_9', goal: 'Rename x', status: 'pending' } } },
				},
				{ type: 'finish' },
			]),
			{ run, userId: 'user-1' },
		);
		const events = await eventsOf(response);
		for (const event of events) expect(EventSchema.safeParse(event).success, event.type).toBe(true);
		expect(events.map((e) => e.type)).toEqual([
			'RUN_STARTED',
			'CUSTOM',
			'STEP_STARTED',
			'TOOL_CALL_START',
			'TOOL_CALL_END',
			'TOOL_CALL_RESULT',
			'STEP_FINISHED',
			'CUSTOM',
			'RUN_FINISHED',
		]);
		expect(events[1]).toMatchObject({ name: 'v10r.thread', value: { conversationId: 'conv-1' } });
		expect(events[7]).toEqual({
			type: 'CUSTOM',
			name: 'v10r.proposal',
			value: { proposalId: 'prp_9', status: 'pending' },
		});
		expect(JSON.stringify(events)).not.toContain('Rename x');
		const result = events[5] as AgUiEvent & { messageId: string; content: string };
		const facts = {
			userId: 'user-1',
			toolCallId: 'c1',
			toolName: 'desk_rename_file',
			args: '',
			content: result.content,
		};
		expect(checkToolResultTicket(result.messageId, facts)).toBe('valid');
		expect(checkToolResultTicket(result.messageId, { ...facts, userId: 'user-2' })).toBe('invalid');
	});

	it('ends a cancelled turn RUN_ERROR cancelled, even though the orchestrator closed it with finish', async () => {
		const left = new AbortController();
		left.abort();
		const events = await eventsOf(
			serveAgUiRun(uiStreamResponse([{ type: 'start' }, { type: 'finish' }]), {
				run,
				userId: 'u',
				signal: left.signal,
			}),
		);
		expect(events.at(-1)).toMatchObject({ type: 'RUN_ERROR', code: 'cancelled' });
		expect(events.map((e) => e.type)).not.toContain('RUN_FINISHED');
	});

	it('closes a stream that ended without a terminal chunk, opening the run first if it never opened', async () => {
		const truncated = await eventsOf(serveAgUiRun(uiStreamResponse([{ type: 'start' }]), { run, userId: 'u' }));
		expect(truncated.map((e) => e.type)).toEqual(['RUN_STARTED', 'CUSTOM', 'RUN_ERROR']);
		const empty = await eventsOf(serveAgUiRun(uiStreamResponse([]), { run, userId: 'u' }));
		expect(empty.map((e) => e.type)).toEqual(['RUN_STARTED', 'CUSTOM', 'RUN_ERROR']);
		expect(empty.at(-1)).toMatchObject({ message: 'The run failed.', code: 'run_failed' });
	});

	it("cancelling the AG-UI body cancels the orchestrator's body — the door that aborts its model calls", async () => {
		let cancelled = false;
		const response = serveAgUiRun(
			uiStreamResponse([{ type: 'start' }], { done: false, onCancel: () => (cancelled = true) }),
			{ run, userId: 'u' },
		);
		const reader = response.body?.getReader();
		await reader?.read();
		await reader?.cancel('client left');
		// The cancel reaches the source through the parser's pipe chain, a few ticks later.
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(cancelled).toBe(true);
	});
});
