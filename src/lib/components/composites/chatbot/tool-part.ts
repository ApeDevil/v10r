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
import { type DeskEffect, TOOL_MANIFEST } from '#lib/types/ai-tools.ts';

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

const CLIENT_EXECUTED: ReadonlySet<string> = new Set(
	TOOL_MANIFEST.filter((d) => d.executor === 'client').map((d) => d.name),
);

/** True for a tool the browser executes — a client action, whose call this client must answer. */
export function isClientExecutedTool(toolName: string): boolean {
	return CLIENT_EXECUTED.has(toolName);
}

/**
 * Whether a settled tool part failed. The part's `state` only says an output arrived: a
 * server tool that refused answers with an `error` envelope, and a client action answers
 * with a result whose `status` is anything but `completed`. Reading `state` alone showed a
 * check mark beside an action the browser had just reported as not done.
 */
export function toolPartFailed(part: ToolPart): boolean {
	if (part.state === 'output-error') return true;
	if (part.state !== 'output-available') return false;
	if (part.output?.error) return true;
	return isClientExecutedTool(toolNameOf(part)) && part.output?.status !== 'completed';
}

export const TOOL_PHASE = {
	'input-streaming': 'pending',
	'input-available': 'running',
	'output-available': 'done',
	'output-error': 'error',
} as const satisfies Record<ToolPartState, string>;
