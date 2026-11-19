/**
 * Client action results — the server's reading of what a browser says it did.
 *
 * A client action (`executor: 'client'` in `TOOL_MANIFEST`) is executed by the user's
 * browser, so its result arrives in the request body, inside the history the client
 * carries. That makes it the one tool result the server did not produce. This module is
 * the door it comes through, before any of it reaches a model:
 *
 *   - a settled result is read through the contract (`parseClientActionResult`): anything
 *     that is not a bounded `ClientActionResult` becomes `malformed_result`, so a browser
 *     cannot use a result as a free-text channel into the prompt;
 *   - a call that was never answered — the tab closed, the turn was stopped — is dropped:
 *     no result means nothing is known, and the model is not left to assume success;
 *   - the results reported since the last model step are handed to the orchestrator, which
 *     records them on the turn trace and continues the SAME assistant message.
 *
 * What it does not do is believe the result. A `completed` here is the user's own browser
 * describing the user's own screen: enough to tell them "it is open", never an input to an
 * authorization decision. Nothing on the server branches on it except the action budget.
 */
import type { UIMessage } from 'ai';
import { type ClientActionResult, parseClientActionResult } from '#lib/client-actions/contract.ts';
import { TOOL_MANIFEST } from '#lib/types/ai-tools.ts';

const CLIENT_EXECUTED: ReadonlySet<string> = new Set(
	TOOL_MANIFEST.filter((d) => d.executor === 'client').map((d) => d.name),
);

/** True for a tool the server never executes — its result can only come from a client. */
export function isClientExecuted(toolName: string): boolean {
	return CLIENT_EXECUTED.has(toolName);
}

/** One client action the browser answered. */
export interface ReportedClientAction {
	toolCallId: string;
	toolName: string;
	input: unknown;
	result: ClientActionResult;
}

export interface ClientActionReading {
	/** The history with every client action result read through the contract. */
	messages: UIMessage[];
	/**
	 * Set when the request continues an assistant message after client actions: the
	 * message being continued and the results reported for its last step. Null on a fresh
	 * user turn and on any request that reports none.
	 */
	continuation: { messageId: string; reported: ReportedClientAction[] } | null;
	/** Client action results reported since the user's last message — the action budget's count. */
	spent: number;
}

interface ToolPartLike {
	type: string;
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
}

const toolNameOfPart = (part: { type: string }): string | null =>
	part.type.startsWith('tool-') ? part.type.slice('tool-'.length) : null;

/** The part as the model may read it, or null when the client never answered the call. */
function settle(part: ToolPartLike): (ToolPartLike & { output: ClientActionResult }) | null {
	if (!part.toolCallId) return null;
	if (part.state === 'output-available') {
		return { ...part, output: parseClientActionResult(part.output), errorText: undefined };
	}
	if (part.state === 'output-error') {
		return {
			...part,
			state: 'output-available',
			output: {
				status: 'failed',
				code: 'client_error',
				message: String(part.errorText ?? 'The client reported an error.').slice(0, 300),
			},
			errorText: undefined,
		};
	}
	return null;
}

export function readClientActionResults(history: readonly UIMessage[]): ClientActionReading {
	let reported: ReportedClientAction[] = [];
	let spent = 0;
	const messages = history.map((message, index) => {
		if (message.role !== 'assistant') return message;
		const isLast = index === history.length - 1;
		const parts: UIMessage['parts'] = [];
		for (const raw of message.parts) {
			const part = raw as ToolPartLike;
			// A new step: results before it were reported by an earlier request.
			if (part.type === 'step-start' && isLast) reported = [];
			const toolName = toolNameOfPart(part);
			if (!toolName || !isClientExecuted(toolName)) {
				parts.push(raw);
				continue;
			}
			const settled = settle(part);
			if (!settled) continue;
			parts.push(settled as unknown as UIMessage['parts'][number]);
			if (isLast) {
				spent += 1;
				reported.push({
					toolCallId: settled.toolCallId as string,
					toolName,
					input: settled.input ?? {},
					result: settled.output,
				});
			}
		}
		return { ...message, parts };
	});
	const last = history[history.length - 1];
	const continuation = last?.role === 'assistant' && reported.length > 0 ? { messageId: last.id, reported } : null;
	return { messages, continuation, spent: last?.role === 'assistant' ? spent : 0 };
}
