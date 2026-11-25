/**
 * AG-UI projection of a turn's UI message stream — an interoperability experiment.
 *
 * v10r's turns stream the AI SDK's UI message protocol to its own Svelte clients. AG-UI
 * (`docs.ag-ui.com`, `@ag-ui/core` 1.0.5) is the open event protocol other agent frontends
 * speak (CopilotKit, the AG-UI dojo, framework clients). Both describe the same things — a
 * run, its steps, streamed text, streamed tool-call arguments, tool results — so an AG-UI
 * client can be served by translating the stream the orchestrator ALREADY produces, chunk by
 * chunk, without a second agent runtime, a second orchestrator or a second tool registry.
 *
 * What maps one-to-one, and what does not:
 * - text, reasoning, tool input/output, steps, start/finish/error/abort map onto AG-UI's
 *   lifecycle, text, reasoning and tool-call events;
 * - a client action (a tool with no server `execute`) is exactly AG-UI's frontend tool: the
 *   run ends on `TOOL_CALL_END`, the client executes, and the next run carries the result —
 *   v10r's continuation request. No event is invented for it;
 * - `message-metadata` (the turn-trace snapshot, bodies already withheld) and `data-*` parts
 *   become `CUSTOM` events under a `v10r.` name: AG-UI has no turn-trace concept and an
 *   invented standard event would be a private dialect;
 * - sources and files have no AG-UI event and are dropped (counted in `dropped`).
 *
 * What an external frontend may SEE is decided by an export policy (`AgUiExportPolicy`),
 * never by what the internal stream happens to carry. The default exports the run's shape
 * and the assistant's text, and withholds the rest: reasoning is omitted, a tool call shows
 * its name and lifecycle but not its arguments or result unless the tool is allowlisted,
 * message metadata (the turn trace) and `data-*` parts pass only by allowlisted key, and an
 * error is reported as a generic message with a code — never the internal error text.
 *
 * The approval gate does not move: a write the model proposes stays a proposal on the
 * server; nothing in this projection executes anything. Pure and synchronous per chunk —
 * `serve-run.ts` serves it over SSE at `POST /api/ai/ag-ui/deskbot`.
 */
import type { UIMessageChunk } from 'ai';

/** The AG-UI events this projection emits — a structural subset of `@ag-ui/core`'s `EventSchema`. */
export type AgUiEvent = { type: string; timestamp?: number } & Record<string, unknown>;

export interface AgUiRun {
	threadId: string;
	runId: string;
}

export interface AgUiProjector {
	/** Events for one chunk, in order. */
	push(chunk: UIMessageChunk): AgUiEvent[];
	/** Chunk types that have no AG-UI counterpart, with counts. */
	dropped(): Record<string, number>;
	/** What the export policy held back, with counts (`reasoning`, `tool_input:<name>`, …). */
	withheld(): Record<string, number>;
}

/**
 * What one external AG-UI frontend may see. An allowlist in every dimension: anything not
 * named is withheld, and the default names nothing beyond the run's shape and its text.
 */
export interface AgUiExportPolicy {
	/** Model reasoning is private by default; `include` is for a frontend the operator owns. */
	reasoning: 'omit' | 'include';
	/** Tools whose arguments and/or results may be exported. Unlisted: name and lifecycle only. */
	tools: Readonly<Record<string, { input: boolean; output: boolean }>>;
	/** Top-level message-metadata keys that may be exported (the trace is withheld unless named). */
	metadataKeys: readonly string[];
	/** `data-*` part names (without the `data-` prefix) that may be exported. */
	dataParts: readonly string[];
	/** Export the internal error text instead of a generic message. Off by default. */
	errorDetail: boolean;
}

export const AG_UI_DEFAULT_EXPORT_POLICY: AgUiExportPolicy = {
	reasoning: 'omit',
	tools: {},
	metadataKeys: [],
	dataParts: [],
	errorDetail: false,
};

/** A tool result as AG-UI's `content` string; bounded so one result cannot flood a client. */
export const AG_UI_TOOL_RESULT_MAX_CHARS = 8_000;

/** What a withheld tool result says in place of its content. */
export const AG_UI_WITHHELD_CONTENT = '[withheld by the export policy]';

const GENERIC_RUN_ERROR = 'The run failed.';

function toolResultContent(output: unknown): string {
	const text = typeof output === 'string' ? output : JSON.stringify(output ?? null);
	return text.length > AG_UI_TOOL_RESULT_MAX_CHARS ? `${text.slice(0, AG_UI_TOOL_RESULT_MAX_CHARS)}…` : text;
}

export function createAgUiProjector(
	run: AgUiRun,
	policy: AgUiExportPolicy = AG_UI_DEFAULT_EXPORT_POLICY,
): AgUiProjector {
	const dropped: Record<string, number> = {};
	const withheldCounts: Record<string, number> = {};
	const withhold = (what: string): AgUiEvent[] => {
		withheldCounts[what] = (withheldCounts[what] ?? 0) + 1;
		return [];
	};
	const exportsInput = (toolCallId: string) => policy.tools[toolNames.get(toolCallId) ?? '']?.input === true;
	const exportsOutput = (toolCallId: string) => policy.tools[toolNames.get(toolCallId) ?? '']?.output === true;
	let messageId = run.runId;
	let step = 0;
	const argsStreamed = new Set<string>();
	const toolNames = new Map<string, string>();
	let finished = false;

	const drop = (type: string): AgUiEvent[] => {
		dropped[type] = (dropped[type] ?? 0) + 1;
		return [];
	};

	function push(chunk: UIMessageChunk): AgUiEvent[] {
		if (finished) return drop(`after_finish:${chunk.type}`);
		switch (chunk.type) {
			case 'start':
				if (chunk.messageId) messageId = chunk.messageId;
				return [{ type: 'RUN_STARTED', threadId: run.threadId, runId: run.runId }];
			case 'start-step':
				step += 1;
				return [{ type: 'STEP_STARTED', stepName: `step-${step}` }];
			case 'finish-step':
				return [{ type: 'STEP_FINISHED', stepName: `step-${step}` }];
			case 'text-start':
				return [{ type: 'TEXT_MESSAGE_START', messageId: chunk.id, role: 'assistant' }];
			case 'text-delta':
				return chunk.delta ? [{ type: 'TEXT_MESSAGE_CONTENT', messageId: chunk.id, delta: chunk.delta }] : [];
			case 'text-end':
				return [{ type: 'TEXT_MESSAGE_END', messageId: chunk.id }];
			case 'reasoning-start':
				if (policy.reasoning === 'omit') return withhold('reasoning');
				return [
					{ type: 'REASONING_START', messageId: chunk.id },
					{ type: 'REASONING_MESSAGE_START', messageId: chunk.id, role: 'reasoning' },
				];
			case 'reasoning-delta':
				if (policy.reasoning === 'omit') return [];
				return chunk.delta ? [{ type: 'REASONING_MESSAGE_CONTENT', messageId: chunk.id, delta: chunk.delta }] : [];
			case 'reasoning-end':
				if (policy.reasoning === 'omit') return [];
				return [
					{ type: 'REASONING_MESSAGE_END', messageId: chunk.id },
					{ type: 'REASONING_END', messageId: chunk.id },
				];
			case 'tool-input-start':
				toolNames.set(chunk.toolCallId, chunk.toolName);
				return [
					{
						type: 'TOOL_CALL_START',
						toolCallId: chunk.toolCallId,
						toolCallName: chunk.toolName,
						parentMessageId: messageId,
					},
				];
			case 'tool-input-delta':
				argsStreamed.add(chunk.toolCallId);
				if (!exportsInput(chunk.toolCallId)) return [];
				return [{ type: 'TOOL_CALL_ARGS', toolCallId: chunk.toolCallId, delta: chunk.inputTextDelta }];
			case 'tool-input-available': {
				const events: AgUiEvent[] = [];
				if (!toolNames.has(chunk.toolCallId)) {
					toolNames.set(chunk.toolCallId, chunk.toolName);
					events.push({
						type: 'TOOL_CALL_START',
						toolCallId: chunk.toolCallId,
						toolCallName: chunk.toolName,
						parentMessageId: messageId,
					});
				}
				if (!exportsInput(chunk.toolCallId)) withhold(`tool_input:${chunk.toolName}`);
				else if (!argsStreamed.has(chunk.toolCallId)) {
					events.push({ type: 'TOOL_CALL_ARGS', toolCallId: chunk.toolCallId, delta: JSON.stringify(chunk.input) });
				}
				events.push({ type: 'TOOL_CALL_END', toolCallId: chunk.toolCallId });
				return events;
			}
			case 'tool-output-available': {
				const exported = exportsOutput(chunk.toolCallId);
				if (!exported) withhold(`tool_output:${toolNames.get(chunk.toolCallId) ?? 'unknown'}`);
				return [
					{
						type: 'TOOL_CALL_RESULT',
						messageId: `${chunk.toolCallId}:result`,
						toolCallId: chunk.toolCallId,
						content: exported ? toolResultContent(chunk.output) : AG_UI_WITHHELD_CONTENT,
						role: 'tool',
					},
				];
			}
			case 'tool-output-error':
			case 'tool-input-error':
				return [
					{
						type: 'TOOL_CALL_RESULT',
						messageId: `${chunk.toolCallId}:result`,
						toolCallId: chunk.toolCallId,
						content: toolResultContent(
							policy.errorDetail ? { error: chunk.errorText } : { error: 'The tool call failed.' },
						),
						role: 'tool',
					},
				];
			case 'message-metadata': {
				const metadata = (chunk.messageMetadata ?? {}) as Record<string, unknown>;
				const exported = Object.fromEntries(
					Object.entries(metadata).filter(([key]) => policy.metadataKeys.includes(key)),
				);
				for (const key of Object.keys(metadata)) if (!(key in exported)) withhold(`metadata:${key}`);
				if (Object.keys(exported).length === 0) return [];
				return [{ type: 'CUSTOM', name: 'v10r.message_metadata', value: exported }];
			}
			case 'error':
				finished = true;
				if (!policy.errorDetail) withhold('error_detail');
				return [
					{ type: 'RUN_ERROR', message: policy.errorDetail ? chunk.errorText : GENERIC_RUN_ERROR, code: 'run_failed' },
				];
			case 'abort':
				finished = true;
				return [{ type: 'RUN_ERROR', message: 'The run was stopped.', code: 'cancelled' }];
			case 'finish':
				finished = true;
				return [{ type: 'RUN_FINISHED', threadId: run.threadId, runId: run.runId }];
			default:
				if (chunk.type.startsWith('data-')) {
					if (!policy.dataParts.includes(chunk.type.slice('data-'.length))) return withhold(chunk.type);
					return [{ type: 'CUSTOM', name: `v10r.${chunk.type}`, value: (chunk as { data?: unknown }).data ?? null }];
				}
				return drop(chunk.type);
		}
	}

	return { push, dropped: () => ({ ...dropped }), withheld: () => ({ ...withheldCounts }) };
}

/** Project a whole recorded stream — tests, fixtures and the Lab page. */
export function projectUiStreamToAgUi(
	run: AgUiRun,
	chunks: readonly UIMessageChunk[],
	policy: AgUiExportPolicy = AG_UI_DEFAULT_EXPORT_POLICY,
) {
	const projector = createAgUiProjector(run, policy);
	const events = chunks.flatMap((chunk) => projector.push(chunk));
	return { events, dropped: projector.dropped(), withheld: projector.withheld() };
}
