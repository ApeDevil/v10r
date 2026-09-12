/**
 * The SDK's tool part, read one way by every consumer: `ChatMessage` (renders the status
 * row), the desk-bot session (logs the call and dispatches the effects a settled tool
 * returned). Two copies of this predicate once matched different part names, and the desk
 * dispatched nothing while the chatbot rendered fine.
 *
 * `tool-<name>` is a statically declared tool (the name is in the type); `dynamic-tool`
 * carries a `toolName` field. `state` walks
 * input-streaming → input-available → output-available | output-error.
 */
import type { DeskEffect } from '$lib/types/ai-tools';

export type ToolPartState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';

export interface ToolPart {
	type: string;
	toolCallId: string;
	toolName?: string;
	state: ToolPartState;
	input?: unknown;
	/** A desk tool's output may carry `effects` for the desk and `error` when it refused. */
	output?: { effects?: DeskEffect[]; error?: string } & Record<string, unknown>;
	errorText?: string;
}

export function isToolPart(part: { type: string }): part is ToolPart {
	return 'toolCallId' in part && (part.type.startsWith('tool-') || part.type === 'dynamic-tool');
}

export function toolNameOf(part: ToolPart): string {
	return part.type === 'dynamic-tool' ? (part.toolName ?? 'tool') : part.type.slice('tool-'.length);
}

export const TOOL_PHASE = {
	'input-streaming': 'pending',
	'input-available': 'running',
	'output-available': 'done',
	'output-error': 'error',
} as const satisfies Record<ToolPartState, string>;
