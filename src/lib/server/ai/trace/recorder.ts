/**
 * Turn recorder — the ONE author of a turn's trace.
 *
 * The orchestrator, the context assembly, the model-call middleware and the AI SDK hooks
 * each report what only they see; the recorder folds it into one `TurnTrace`
 * (`$lib/types/turn-trace.ts`), hands the client a bodies-free `snapshot()` on every
 * change (the orchestrator micro-batches those into `message-metadata` frames), and
 * writes the whole thing once, at the end (`persist()` — idempotent, never throws into
 * the answer).
 *
 * Event names follow the lifecycle (`callStart`/`callEnd`, `attemptStart`/`attemptEnd`,
 * `tool`) rather than the SDK's callback names, so the v7 hook renames touch the
 * orchestrator's adapter lines and nothing here. Everything recorded comes from the
 * actual execution — the recorder never runs anything itself.
 */
import type { LanguageModelUsage, ModelMessage, ToolSet } from 'ai';
import { hashSystemPrompt } from '$lib/server/ai/context/history';
import { saveTurnTrace } from '$lib/server/db/ai/mutations';
import { createId } from '$lib/server/db/id';
import type { AiErrorKind } from '$lib/types/ai-error';
import type { CapabilityId } from '$lib/types/assistant-profile';
import type { AiSurface } from '$lib/types/db-enums';
import type {
	Activation,
	AttemptOutcome,
	CitationRecord,
	GroundingSource,
	HistoryMessage,
	HistoryPart,
	ModelCallRecord,
	ModelCallRequest,
	ModelCallResponse,
	PromptBlock,
	ToolDefinitionRecord,
	ToolExecutionRecord,
	ToolExecutionStatus,
	TurnAwareness,
	TurnHistory,
	TurnOutcome,
	TurnTimings,
	TurnTrace,
	TurnTraceSnapshot,
} from '$lib/types/turn-trace';

/** Model-facing tool results above this size are stored as a capped preview. */
export const TOOL_RESULT_CAP_CHARS = 8_000;

export interface TurnRecorderInit {
	conversationId: string | null;
	messageId: string;
	surface: AiSurface;
	requestId: string;
	userId: string;
	/** The turn's origin (`performance.now()`): every offset is measured from it. */
	t0: number;
}

/** What the middleware reports when a provider request leaves. */
export interface CallStartInput {
	request: ModelCallRequest;
	/** The tool definitions as sent — recorded once per turn, on the first call that carries them. */
	toolset?: ToolDefinitionRecord[];
	providerId?: string | null;
	modelId?: string | null;
}

/** What the SDK's step hook reports when a provider request has answered. */
export interface CallEndInput {
	stepIndex?: number;
	usage?: LanguageModelUsage;
	finishReason?: string;
	responseId?: string;
	responseModel?: string;
	textChars?: number;
	toolCalls?: { toolCallId: string; toolName: string }[];
	warnings?: string[];
}

/** What a tool execution reports — the SDK hook and the step's result loop each bring part. */
export interface ToolInput {
	toolCallId: string;
	toolName: string;
	input?: unknown;
	output?: unknown;
	status?: ToolExecutionStatus;
	errorMessage?: string;
	durationMs?: number;
}

export interface TurnRecorder {
	readonly requestId: string;
	readonly messageId: string;
	awareness(awareness: TurnAwareness): void;
	activation(id: CapabilityId, active: boolean, reason?: string): void;
	block(block: Omit<PromptBlock, 'chars' | 'text'> & { text: string; chars?: number }): void;
	grounding(source: GroundingSource): void;
	/** Outline the history as sent; returns the outline so the turn can size its request. */
	history(messages: ModelMessage[], droppedMessages: number): TurnHistory;
	/** The tools mounted this turn, by name — the middleware adds the definitions as sent. */
	toolsOffered(tools: ToolSet): void;
	attemptStart(attempt: { providerId: string | null; modelId: string | null }): void;
	attemptEnd(outcome: AttemptOutcome, detail?: { errorKind?: AiErrorKind; contentParts?: number }): void;
	callStart(input: CallStartInput): string;
	callEnd(input: CallEndInput): void;
	/** ms from the open call's start to its first streamed token. */
	firstToken(): void;
	tool(input: ToolInput): void;
	/** A tool result was compacted before the model saw it: attach the ref to that execution. */
	compacted(toolName: string, compaction: { ref: string; originalBytes: number }): void;
	citations(records: CitationRecord[]): void;
	timing(patch: Partial<TurnTimings>): void;
	proposal(id: string): void;
	outcome(outcome: TurnOutcome, errorKind?: AiErrorKind | null): void;
	/** Called after every change; the orchestrator schedules one metadata frame per burst. */
	subscribe(listener: () => void): void;
	snapshot(): TurnTraceSnapshot;
	trace(): TurnTrace;
	/** Write the trace once. Safe to call twice; a failure is logged, never thrown. */
	persist(): Promise<void>;
}

const serializedLength = (value: unknown): number => {
	try {
		return JSON.stringify(value)?.length ?? 0;
	} catch {
		return 0;
	}
};

/** The model-facing value, or a preview of it when it is larger than the trace keeps. */
function capToolOutput(value: unknown): unknown {
	if (value === undefined) return undefined;
	let text: string;
	try {
		text = JSON.stringify(value) ?? '';
	} catch {
		return { capped: true, chars: 0, preview: '[unserializable]' };
	}
	if (text.length <= TOOL_RESULT_CAP_CHARS) return value;
	return { capped: true, chars: text.length, preview: text.slice(0, TOOL_RESULT_CAP_CHARS) };
}

function isCompactedProjection(value: unknown): value is { ref: string; originalBytes: number } {
	return (
		!!value &&
		typeof value === 'object' &&
		(value as { truncated?: unknown }).truncated === true &&
		typeof (value as { ref?: unknown }).ref === 'string'
	);
}

/** Outline one history message: part kinds and sizes, never the text. */
function outlineMessage(msg: ModelMessage): HistoryMessage {
	const content = (msg as { content: unknown }).content;
	if (typeof content === 'string') {
		return { role: msg.role, parts: [{ type: 'text', chars: content.length }] };
	}
	const parts: HistoryPart[] = [];
	for (const raw of Array.isArray(content) ? content : []) {
		const part = raw as Record<string, unknown>;
		switch (part.type) {
			case 'text':
				parts.push({ type: 'text', chars: String(part.text ?? '').length });
				break;
			case 'reasoning':
				parts.push({ type: 'reasoning', chars: String(part.text ?? '').length });
				break;
			case 'tool-call':
				parts.push({ type: 'tool_call', toolName: String(part.toolName ?? ''), chars: serializedLength(part.input) });
				break;
			case 'tool-result': {
				const output = part.output as { value?: unknown } | undefined;
				const value = output && typeof output === 'object' && 'value' in output ? output.value : output;
				if (isCompactedProjection(value) || isCompactedProjection(output)) {
					const projection = isCompactedProjection(value) ? value : (output as { ref: string; originalBytes: number });
					parts.push({
						type: 'compaction',
						toolName: String(part.toolName ?? ''),
						chars: serializedLength(output),
						ref: projection.ref,
					});
				} else {
					parts.push({
						type: 'tool_call_response',
						toolName: String(part.toolName ?? ''),
						chars: serializedLength(output),
					});
				}
				break;
			}
			case 'file':
			case 'image':
				parts.push({ type: 'file', chars: 0 });
				break;
			default:
				parts.push({ type: 'other', chars: serializedLength(part) });
		}
	}
	return { role: msg.role, parts };
}

export function outlineHistory(messages: ModelMessage[], droppedMessages: number): TurnHistory {
	return { messages: messages.map(outlineMessage), droppedMessages };
}

/** Every part's size summed — what the history costs the request, in chars. */
export function historyChars(history: TurnHistory): number {
	return history.messages.reduce((total, message) => total + message.parts.reduce((n, part) => n + part.chars, 0), 0);
}

export function createTurnRecorder(init: TurnRecorderInit): TurnRecorder {
	const { t0 } = init;
	const now = () => Math.round(performance.now() - t0);

	let awareness: TurnAwareness = { locale: 'en', authCeiling: null };
	const activations: Activation[] = [];
	const blocks: PromptBlock[] = [];
	const grounding: GroundingSource[] = [];
	let history: TurnHistory = { messages: [], droppedMessages: 0 };
	let toolset: ToolDefinitionRecord[] = [];
	let toolNames: string[] = [];
	const modelCalls: ModelCallRecord[] = [];
	const toolExecutions: ToolExecutionRecord[] = [];
	const attempts: TurnTrace['attempts'] = [];
	let citations: CitationRecord[] = [];
	let timings: TurnTimings = {};
	let proposalId: string | null = null;
	let outcome: TurnOutcome = 'ok';
	let errorKind: AiErrorKind | null = null;
	let listener: (() => void) | undefined;
	let persisted: Promise<void> | undefined;

	/** Per-call wall clock, keyed by call id. */
	const callStartedAt = new Map<string, number>();
	/** First streamed token per call id, ms from the call's start. */
	const firstTokenAt = new Map<string, number>();
	/** Compactions reported before their execution's hook fired, by tool name (FIFO). */
	const pendingCompactions = new Map<string, { ref: string; originalBytes: number }[]>();

	const changed = () => listener?.();
	const currentAttempt = () => attempts[attempts.length - 1];
	const openCall = () => [...modelCalls].reverse().find((c) => c.response === null && c.outcome === 'ok');

	const profileVersion = () =>
		hashSystemPrompt(
			`${blocks
				.filter((b) => b.stable)
				.map((b) => `${b.id}\n${b.text ?? ''}`)
				.join('\n\n')}\n\n${JSON.stringify(toolset.map((t) => [t.name, t.description, t.inputSchema]))}`,
		);

	const trace = (): TurnTrace => ({
		messageId: init.messageId,
		conversationId: init.conversationId,
		surface: init.surface,
		requestId: init.requestId,
		profileVersion: profileVersion(),
		outcome,
		errorKind,
		timings,
		awareness,
		activations: [...activations],
		blocks: blocks.map((b) => ({ ...b })),
		grounding: grounding.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) })),
		history,
		toolset,
		modelCalls: modelCalls.map((c) => ({ ...c, request: { ...c.request }, response: c.response && { ...c.response } })),
		toolExecutions: toolExecutions.map((t) => ({ ...t })),
		attempts: attempts.map((a) => ({ ...a })),
		citations: [...citations],
		proposalId,
		createdAt: new Date().toISOString(),
		bodies: 'inline',
	});

	return {
		requestId: init.requestId,
		messageId: init.messageId,

		awareness(next) {
			awareness = next;
			changed();
		},

		activation(id, active, reason) {
			const existing = activations.find((a) => a.id === id);
			if (existing) {
				existing.active = active;
				existing.reason = reason;
			} else {
				activations.push(reason === undefined ? { id, active } : { id, active, reason });
			}
			changed();
		},

		block(block) {
			blocks.push({ ...block, chars: block.chars ?? block.text.length });
			changed();
		},

		grounding(source) {
			const index = grounding.findIndex((g) => g.id === source.id);
			if (index === -1) grounding.push(source);
			else grounding[index] = source;
			changed();
		},

		history(messages, droppedMessages) {
			history = outlineHistory(messages, droppedMessages);
			changed();
			return history;
		},

		toolsOffered(tools) {
			toolNames = Object.keys(tools);
			if (toolset.length === 0) {
				// Names only until the middleware reports the definitions as sent.
				toolset = toolNames.map((name) => {
					const def = tools[name] as { description?: string } | undefined;
					return { name, description: def?.description ?? '', inputSchema: null };
				});
			}
			changed();
		},

		attemptStart(attempt) {
			attempts.push({ attemptIndex: attempts.length, ...attempt, outcome: 'started' });
			changed();
		},

		attemptEnd(attemptOutcome, detail) {
			const attempt = currentAttempt();
			if (!attempt) return;
			attempt.outcome = attemptOutcome;
			if (detail?.errorKind) attempt.errorKind = detail.errorKind;
			if (detail?.contentParts !== undefined) attempt.contentParts = detail.contentParts;
			// A call still open when its attempt fails never answered.
			if (attemptOutcome === 'failed' || attemptOutcome === 'rotated' || attemptOutcome === 'cancelled') {
				const open = openCall();
				if (open) {
					open.outcome = attemptOutcome === 'cancelled' ? 'cancelled' : 'error';
					const started = callStartedAt.get(open.id);
					if (started !== undefined) open.durationMs = now() - started;
				}
			}
			changed();
		},

		callStart(input) {
			const attempt = currentAttempt();
			const id = createId.modelCall();
			const stepIndex = modelCalls.filter((c) => c.attemptIndex === (attempt?.attemptIndex ?? 0)).length;
			modelCalls.push({
				id,
				attemptIndex: attempt?.attemptIndex ?? 0,
				stepIndex,
				providerId: input.providerId ?? attempt?.providerId ?? null,
				modelId: input.modelId ?? attempt?.modelId ?? null,
				inputTokens: 0,
				outputTokens: 0,
				durationMs: null,
				startOffsetMs: now(),
				request: input.request,
				response: null,
				outcome: 'ok',
			});
			callStartedAt.set(id, now());
			if (input.toolset && input.toolset.length > 0 && toolset.every((t) => t.inputSchema === null)) {
				toolset = input.toolset;
			}
			changed();
			return id;
		},

		callEnd(input) {
			let call = openCall();
			if (!call) {
				// The middleware did not see this call (a mocked or non-v3 model): open it here so
				// the usage ledger is complete even without the request outline.
				const attempt = currentAttempt();
				const id = createId.modelCall();
				call = {
					id,
					attemptIndex: attempt?.attemptIndex ?? 0,
					stepIndex:
						input.stepIndex ?? modelCalls.filter((c) => c.attemptIndex === (attempt?.attemptIndex ?? 0)).length,
					providerId: attempt?.providerId ?? null,
					modelId: attempt?.modelId ?? null,
					inputTokens: 0,
					outputTokens: 0,
					durationMs: null,
					request: { systemHash: '', blockIds: [], historyCount: 0, toolsOffered: toolNames },
					response: null,
					outcome: 'ok',
				};
				modelCalls.push(call);
			}
			const started = callStartedAt.get(call.id);
			call.durationMs = started === undefined ? null : now() - started;
			call.inputTokens = input.usage?.inputTokens ?? 0;
			call.outputTokens = input.usage?.outputTokens ?? 0;
			// A call that reaches callEnd completed; attemptEnd marks the open call on error/cancel.
			call.outcome = 'ok';
			const response: ModelCallResponse = {
				textChars: input.textChars ?? 0,
				toolCalls: input.toolCalls ?? [],
			};
			if (input.responseId) response.responseId = input.responseId;
			if (input.responseModel) response.responseModel = input.responseModel;
			if (input.finishReason) response.finishReason = input.finishReason;
			if (input.warnings?.length) response.warnings = input.warnings;
			const cacheRead = input.usage?.inputTokenDetails?.cacheReadTokens;
			if (cacheRead !== undefined) response.cacheReadTokens = cacheRead;
			const reasoning = input.usage?.outputTokenDetails?.reasoningTokens;
			if (reasoning !== undefined) response.reasoningTokens = reasoning;
			const first = firstTokenAt.get(call.id);
			if (first !== undefined) response.firstTokenMs = first;
			call.response = response;
			// The executions this call asked for belong to it.
			for (const tc of response.toolCalls) {
				const exec = toolExecutions.find((t) => t.toolCallId === tc.toolCallId);
				if (exec && !exec.modelCallId) exec.modelCallId = call.id;
			}
			changed();
		},

		firstToken() {
			const call = openCall();
			const started = call ? callStartedAt.get(call.id) : undefined;
			const ms = started === undefined ? now() : now() - started;
			if (call) firstTokenAt.set(call.id, ms);
			timings = { ...timings, firstTokenMs: [...(timings.firstTokenMs ?? []), ms] };
			changed();
		},

		tool(input) {
			let exec = toolExecutions.find((t) => t.toolCallId === input.toolCallId);
			if (!exec) {
				exec = {
					id: createId.toolCall(),
					toolCallId: input.toolCallId,
					toolName: input.toolName,
					ordinal: toolExecutions.length,
					status: input.status ?? 'success',
					startOffsetMs: now() - Math.round(input.durationMs ?? 0),
				};
				const call = openCall();
				if (call) exec.modelCallId = call.id;
				toolExecutions.push(exec);
			}
			if (input.input !== undefined) exec.input = input.input;
			if (input.output !== undefined) exec.output = capToolOutput(input.output);
			if (input.status) exec.status = input.status;
			if (input.errorMessage !== undefined) exec.errorMessage = input.errorMessage;
			if (input.durationMs !== undefined) exec.durationMs = Math.round(input.durationMs);
			if (!exec.compaction) {
				const queue = pendingCompactions.get(input.toolName);
				const compaction = queue?.shift();
				if (compaction) exec.compaction = compaction;
				else if (isCompactedProjection(input.output)) {
					exec.compaction = { ref: input.output.ref, originalBytes: input.output.originalBytes };
				}
			}
			changed();
		},

		compacted(toolName, compaction) {
			const queue = pendingCompactions.get(toolName) ?? [];
			queue.push(compaction);
			pendingCompactions.set(toolName, queue);
		},

		citations(records) {
			citations = records;
			const cited = new Set(records.map((r) => `${r.source}\0${r.itemId}`));
			for (const source of grounding) {
				for (const item of source.items) {
					if (cited.has(`${source.id}\0${item.id}`)) item.state = 'cited';
				}
			}
			changed();
		},

		timing(patch) {
			const finalize = patch.finalize || timings.finalize ? { ...timings.finalize, ...patch.finalize } : undefined;
			timings = { ...timings, ...patch, ...(finalize ? { finalize } : {}) };
			changed();
		},

		proposal(id) {
			proposalId = id;
			changed();
		},

		outcome(next, kind) {
			outcome = next;
			errorKind = kind ?? null;
			changed();
		},

		subscribe(next) {
			listener = next;
		},

		snapshot() {
			const full = trace();
			return {
				messageId: full.messageId,
				conversationId: full.conversationId,
				surface: full.surface,
				requestId: full.requestId,
				profileVersion: full.profileVersion,
				outcome: full.outcome,
				errorKind: full.errorKind,
				timings: full.timings,
				awareness: full.awareness,
				activations: full.activations,
				blocks: full.blocks.map(({ text: _text, ...outline }) => outline),
				grounding: full.grounding.map((g) => ({
					...g,
					items: g.items.map(({ body: _body, ...item }) => item),
				})),
				history: full.history,
				modelCalls: full.modelCalls,
				toolExecutions: full.toolExecutions.map(({ input: _input, output: _output, ...outline }) => outline),
				attempts: full.attempts,
				citations: full.citations,
				proposalId: full.proposalId,
				bodies: 'persisted',
			};
		},

		trace,

		persist() {
			if (!persisted) {
				persisted = saveTurnTrace(trace(), init.userId).catch((err) => {
					console.error('[ai:trace] Failed to persist turn trace:', err instanceof Error ? err.message : err);
				});
			}
			return persisted;
		},
	};
}
