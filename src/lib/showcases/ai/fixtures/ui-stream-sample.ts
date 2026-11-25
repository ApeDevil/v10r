/**
 * A hand-written AI SDK UI message stream — one deskbot-shaped turn: a server read, a client
 * action, reasoning, streamed text, the trace metadata, a source. The Interop Lab projects it
 * to AG-UI events, so the page shows what an AG-UI client would receive without a live model.
 * Authored, not recorded: the ids are fixed and no provider produced it.
 */
import type { UIMessageChunk } from 'ai';

export const UI_STREAM_SAMPLE_RUN = { threadId: 'lab_thread', runId: 'lab_run' } as const;

export const UI_STREAM_SAMPLE: readonly UIMessageChunk[] = [
	{ type: 'start', messageId: 'lab_message' },
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
		output: { files: [{ id: 'lab_file', name: 'Architecture.md' }] },
	},
	{ type: 'finish-step' },
	{ type: 'start-step' },
	{ type: 'reasoning-start', id: 'r1' },
	{ type: 'reasoning-delta', id: 'r1', delta: 'Open it on the right.' },
	{ type: 'reasoning-end', id: 'r1' },
	// A client action: no output follows — the browser executes it (AG-UI's frontend tool).
	{ type: 'tool-input-available', toolCallId: 'call_2', toolName: 'desk_open_file', input: { fileId: 'lab_file' } },
	{ type: 'finish-step' },
	{ type: 'message-metadata', messageMetadata: { trace: { outcome: 'ok' } } },
	{ type: 'text-start', id: 't1' },
	{ type: 'text-delta', id: 't1', delta: 'Opening it now.' },
	{ type: 'text-end', id: 't1' },
	{ type: 'finish' },
];
