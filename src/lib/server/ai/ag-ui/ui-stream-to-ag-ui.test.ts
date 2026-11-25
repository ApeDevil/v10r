import { EventSchema } from '@ag-ui/core/schemas';
import type { UIMessageChunk } from 'ai';
import { describe, expect, it } from 'vitest';
import {
	AG_UI_TOOL_RESULT_MAX_CHARS,
	AG_UI_WITHHELD_CONTENT,
	type AgUiExportPolicy,
	projectUiStreamToAgUi,
} from './ui-stream-to-ag-ui';

const run = { threadId: 'demo_thread', runId: 'demo_run' };

/** A deskbot-shaped turn: a server read, a client action, streamed text, the trace metadata. */
const turn: UIMessageChunk[] = [
	{ type: 'start', messageId: 'demo_message' },
	{ type: 'start-step' },
	{ type: 'tool-input-start', toolCallId: 'call_1', toolName: 'desk_search_files' },
	{ type: 'tool-input-delta', toolCallId: 'call_1', inputTextDelta: '{"query":' },
	{ type: 'tool-input-delta', toolCallId: 'call_1', inputTextDelta: '"architecture"}' },
	{
		type: 'tool-input-available',
		toolCallId: 'call_1',
		toolName: 'desk_search_files',
		input: { query: 'architecture' },
	},
	{
		type: 'tool-output-available',
		toolCallId: 'call_1',
		output: { files: [{ id: 'demo_file', name: 'Architecture.md' }] },
	},
	{ type: 'finish-step' },
	{ type: 'start-step' },
	{ type: 'reasoning-start', id: 'r1' },
	{ type: 'reasoning-delta', id: 'r1', delta: 'Open it on the right.' },
	{ type: 'reasoning-end', id: 'r1' },
	// A client action: no output follows — the browser executes it (AG-UI's frontend tool).
	{ type: 'tool-input-available', toolCallId: 'call_2', toolName: 'desk_open_file', input: { fileId: 'demo_file' } },
	{ type: 'finish-step' },
	{ type: 'message-metadata', messageMetadata: { trace: { outcome: 'ok' } } },
	{ type: 'text-start', id: 't1' },
	{ type: 'text-delta', id: 't1', delta: 'Opening it now.' },
	{ type: 'text-end', id: 't1' },
	{ type: 'source-url', sourceId: 's1', url: 'https://example.com' },
	{ type: 'finish' },
];

/** An operator-owned frontend: everything in this turn may be shown. */
const open: AgUiExportPolicy = {
	reasoning: 'include',
	tools: { desk_search_files: { input: true, output: true }, desk_open_file: { input: true, output: true } },
	metadataKeys: ['trace'],
	dataParts: [],
	errorDetail: true,
};

describe('projectUiStreamToAgUi', () => {
	it('emits only events that the official AG-UI schemas accept, under either policy', () => {
		const events = [...projectUiStreamToAgUi(run, turn, open).events, ...projectUiStreamToAgUi(run, turn).events];
		for (const event of events) {
			const parsed = EventSchema.safeParse(event);
			expect(parsed.success, `${event.type}: ${parsed.success ? '' : parsed.error.message}`).toBe(true);
		}
	});

	it('frames the run and keeps tool-call arguments streamed, not repeated', () => {
		const { events } = projectUiStreamToAgUi(run, turn, open);
		expect(events[0]).toMatchObject({ type: 'RUN_STARTED', threadId: 'demo_thread', runId: 'demo_run' });
		expect(events.at(-1)).toMatchObject({ type: 'RUN_FINISHED' });
		const args = events.filter((e) => e.type === 'TOOL_CALL_ARGS' && e.toolCallId === 'call_1');
		expect(args.map((e) => e.delta).join('')).toBe('{"query":"architecture"}');
	});

	it('turns a client action into a frontend tool call that ends the run without a result', () => {
		const { events } = projectUiStreamToAgUi(run, turn, open);
		const call2 = events.filter((e) => e.toolCallId === 'call_2').map((e) => e.type);
		expect(call2).toEqual(['TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END']);
	});

	it('carries v10r facts as CUSTOM events and counts what AG-UI has no event for', () => {
		const { events, dropped } = projectUiStreamToAgUi(run, turn, open);
		expect(events.find((e) => e.type === 'CUSTOM')).toMatchObject({ name: 'v10r.message_metadata' });
		expect(dropped).toEqual({ 'source-url': 1 });
	});

	it('maps abort to a cancelled RUN_ERROR and ignores anything after the run ended', () => {
		const { events, dropped } = projectUiStreamToAgUi(run, [
			{ type: 'start' },
			{ type: 'abort' },
			{ type: 'text-start', id: 'late' },
		]);
		expect(events.map((e) => e.type)).toEqual(['RUN_STARTED', 'RUN_ERROR']);
		expect(dropped).toEqual({ 'after_finish:text-start': 1 });
	});

	it('bounds a tool result', () => {
		const { events } = projectUiStreamToAgUi(
			run,
			[
				{ type: 'tool-input-available', toolCallId: 'big', toolName: 'desk_search_files', input: {} },
				{ type: 'tool-output-available', toolCallId: 'big', output: 'x'.repeat(AG_UI_TOOL_RESULT_MAX_CHARS * 3) },
			],
			open,
		);
		const result = events.find((e) => e.type === 'TOOL_CALL_RESULT');
		expect(String(result?.content).length).toBeLessThanOrEqual(AG_UI_TOOL_RESULT_MAX_CHARS + 1);
	});
});

describe('the default export policy', () => {
	const projected = projectUiStreamToAgUi(run, turn);
	const json = JSON.stringify(projected.events);

	it('omits reasoning entirely', () => {
		expect(projected.events.some((e) => e.type.startsWith('REASONING'))).toBe(false);
		expect(json).not.toContain('Open it on the right');
		expect(projected.withheld.reasoning).toBe(1);
	});

	it("shows a tool call's name and lifecycle but not its arguments or result", () => {
		expect(projected.events.filter((e) => e.toolCallId === 'call_1').map((e) => e.type)).toEqual([
			'TOOL_CALL_START',
			'TOOL_CALL_END',
			'TOOL_CALL_RESULT',
		]);
		expect(json).not.toContain('architecture"');
		expect(json).not.toContain('Architecture.md');
		expect(projected.events.find((e) => e.type === 'TOOL_CALL_RESULT')?.content).toBe(AG_UI_WITHHELD_CONTENT);
	});

	it('withholds the turn trace and unlisted data parts', () => {
		expect(projected.events.some((e) => e.type === 'CUSTOM')).toBe(false);
		expect(projected.withheld['metadata:trace']).toBe(1);
		const data = projectUiStreamToAgUi(run, [{ type: 'data-proposal', data: { secret: 1 } } as never]);
		expect(data.events).toEqual([]);
		expect(data.withheld).toEqual({ 'data-proposal': 1 });
	});

	it('reports errors generically, never the internal error text', () => {
		const failed = projectUiStreamToAgUi(run, [
			{ type: 'start' },
			{ type: 'tool-input-available', toolCallId: 'c', toolName: 'desk_search_files', input: {} },
			{ type: 'tool-output-error', toolCallId: 'c', errorText: 'ECONNREFUSED 10.0.0.5:5432 password=hunter2' },
			{ type: 'error', errorText: 'provider key sk-live-123 rejected' },
		]);
		const text = JSON.stringify(failed.events);
		expect(text).not.toContain('hunter2');
		expect(text).not.toContain('sk-live');
		expect(failed.events.at(-1)).toMatchObject({ type: 'RUN_ERROR', message: 'The run failed.', code: 'run_failed' });
	});

	it('still keeps the assistant text and the run frame', () => {
		expect(projected.events[0]).toMatchObject({ type: 'RUN_STARTED' });
		expect(projected.events.at(-1)).toMatchObject({ type: 'RUN_FINISHED' });
		expect(json).toContain('Opening it now.');
	});
});

describe('the schema check itself', () => {
	it('rejects an event AG-UI does not define, so the conformance test above can fail', () => {
		expect(EventSchema.safeParse({ type: 'V10R_INVENTED' }).success).toBe(false);
		expect(EventSchema.safeParse({ type: 'TOOL_CALL_START', toolCallId: 'x' }).success).toBe(false);
	});
});
