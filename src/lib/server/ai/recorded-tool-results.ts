/**
 * Recorded tool results — the server's own results replace the copies a client sends back.
 *
 * A turn's history arrives in the request body, so every tool result in it is what the client
 * says the server answered. A client action result is honestly the client's (it goes through
 * `client-action-results.ts`); every other result was produced by a server tool and persisted
 * on the assistant row that streamed it. This module puts the persisted copy back:
 *
 *   - a server tool part whose call id the conversation's rows hold is replaced by the
 *     recorded part (input, state, output) — an edited output never reaches the model;
 *   - a server tool part the rows do not hold (a forged call, a new conversation sent with
 *     invented history) is `unrecorded`: it stays in the thread, but the model receives it
 *     wrapped as untrusted content whatever the tool's declared origin
 *     (`boundHistoryToolResults`), so a `system`-origin claim like a docs search result gains
 *     no authority by being typed by the client.
 *
 * Authority never depended on these results: approvals are proposal rows, receipts are written
 * by the approve door. What this closes is the trust a recorded `system` result earns in the
 * prompt.
 */
import type { UIMessage } from 'ai';
import { isClientExecuted } from './client-action-results';

interface PartsBearing {
	parts?: readonly unknown[] | null;
}

type ToolPart = Record<string, unknown> & { type: string; toolCallId: string };

const SETTLED = new Set(['output-available', 'output-error']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function serverToolPart(part: unknown): part is ToolPart {
	return (
		isRecord(part) &&
		typeof part.type === 'string' &&
		part.type.startsWith('tool-') &&
		typeof part.toolCallId === 'string' &&
		typeof part.state === 'string' &&
		SETTLED.has(part.state) &&
		!isClientExecuted(part.type.slice('tool-'.length))
	);
}

export interface RecordedToolResults {
	messages: UIMessage[];
	/** Call ids of server tool results the conversation's rows do not hold. */
	unrecorded: ReadonlySet<string>;
}

/** Replace every server tool result in `history` with the copy `stored` holds, or mark it unrecorded. */
export function adoptRecordedToolResults(
	history: readonly UIMessage[],
	stored: readonly PartsBearing[],
): RecordedToolResults {
	const recorded = new Map<string, ToolPart>();
	for (const row of stored)
		for (const part of row.parts ?? []) if (serverToolPart(part)) recorded.set(part.toolCallId, part);

	const unrecorded = new Set<string>();
	const messages = history.map((message) => {
		if (message.role !== 'assistant') return message;
		let changed = false;
		const parts = message.parts.map((part) => {
			if (!serverToolPart(part)) return part;
			const own = recorded.get(part.toolCallId);
			if (!own || own.type !== part.type) {
				unrecorded.add(part.toolCallId);
				return part;
			}
			changed = true;
			const { input, state, output, errorText } = own;
			const adopted: Record<string, unknown> = { ...part, input, state };
			delete adopted.output;
			delete adopted.errorText;
			if (state === 'output-error') adopted.errorText = errorText;
			else adopted.output = output;
			return adopted as typeof part;
		});
		return changed ? { ...message, parts } : message;
	});
	return { messages, unrecorded };
}
