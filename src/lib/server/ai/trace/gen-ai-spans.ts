/**
 * The turn trace read as OpenTelemetry GenAI spans — a projection, not a second tracer.
 *
 * v10r already records every turn once, from the actual execution (`recorder.ts`, rows in
 * `ai.turn` / `ai.model_call` / `ai.tool_call`). An operator who runs an OpenTelemetry
 * backend wants the same facts in the vocabulary of the GenAI semantic conventions
 * (`github.com/open-telemetry/semantic-conventions-genai`, status *Development* in 2026-11):
 * one `invoke_agent` span per turn, one `chat` span per provider request, one `execute_tool`
 * span per tool execution. This module maps a `TurnTrace` onto that shape and nothing else:
 * no SDK, no exporter, no clock — the caller (an exporter, the Lab page, a test) decides
 * where spans go. Adding an OpenTelemetry SDK is an operator choice that this projection
 * makes cheap; it is not a dependency of the app.
 *
 * Three rules:
 * - **No content.** The conventions make prompt and completion capture opt-in; the trace's
 *   bodies (block text, tool input and output) never enter a span here, by construction —
 *   there is no option to turn them on. Content stays in the owner-scoped trace, under its
 *   redact-at-30 d / delete-at-180 d policy. Audit evidence (proposal receipts) is not
 *   telemetry and is not projected.
 * - **Standard names where the convention has one, `v10r.*` where it does not.** Attempt and
 *   step indices, tool risk and executor, first-token latency are v10r facts; inventing
 *   `gen_ai.*` names for them would be a private dialect of a public vocabulary.
 * - **Pinned to one convention revision** (`GEN_AI_SEMCONV_REVISION`). The conventions are
 *   still in Development; a rename upstream is one edit here, recorded in the matrix.
 */
import { TOOL_MANIFEST } from '#lib/types/ai-tools.ts';
import type { ModelCallRecord, ToolExecutionRecord, TurnTrace } from '#lib/types/turn-trace.ts';

/** The semantic-conventions-genai revision these names were read from. */
export const GEN_AI_SEMCONV_REVISION = '0.1.0';

export type GenAiOperation = 'invoke_agent' | 'chat' | 'execute_tool';

export type GenAiAttributeValue = string | number | boolean | string[];

/** One span as the conventions describe it — exporter-neutral. */
export interface GenAiSpan {
	/** Stable within the turn: `turn`, `call:<modelCallId>`, `tool:<executionId>`. */
	id: string;
	parentId: string | null;
	/** `{operation} {target}` — the conventions' span name. */
	name: string;
	operation: GenAiOperation;
	/** Client spans for provider requests, internal for the agent and its tools. */
	kind: 'client' | 'internal';
	startOffsetMs: number | null;
	durationMs: number | null;
	status: 'ok' | 'error' | 'unset';
	attributes: Record<string, GenAiAttributeValue>;
}

/**
 * v10r provider ids → `gen_ai.provider.name` well-known values. An id the conventions have
 * no value for is passed through: the attribute is open-ended by design.
 */
const PROVIDER_NAMES: Record<string, string> = {
	openai: 'openai',
	google: 'gcp.gemini',
	groq: 'groq',
	anthropic: 'anthropic',
};

const AGENT_NAMES: Record<TurnTrace['surface'], string> = {
	chatbot: 'Vely',
	deskbot: 'Workspace operator',
};

function providerName(providerId: string | null): string | undefined {
	if (!providerId) return undefined;
	return PROVIDER_NAMES[providerId] ?? providerId;
}

function put(attributes: Record<string, GenAiAttributeValue>, key: string, value: GenAiAttributeValue | undefined) {
	if (value === undefined || value === null) return;
	if (Array.isArray(value) && value.length === 0) return;
	attributes[key] = value;
}

function chatSpan(call: ModelCallRecord, parentId: string): GenAiSpan {
	const attributes: Record<string, GenAiAttributeValue> = { 'gen_ai.operation.name': 'chat' };
	put(attributes, 'gen_ai.provider.name', providerName(call.providerId));
	put(attributes, 'gen_ai.request.model', call.modelId ?? undefined);
	put(attributes, 'gen_ai.response.model', call.response?.responseModel);
	put(attributes, 'gen_ai.response.id', call.response?.responseId);
	put(attributes, 'gen_ai.response.finish_reasons', call.response?.finishReason ? [call.response.finishReason] : []);
	put(attributes, 'gen_ai.usage.input_tokens', call.inputTokens);
	put(attributes, 'gen_ai.usage.output_tokens', call.outputTokens);
	put(attributes, 'gen_ai.usage.cache_read.input_tokens', call.response?.cacheReadTokens);
	put(attributes, 'v10r.attempt.index', call.attemptIndex);
	put(attributes, 'v10r.step.index', call.stepIndex);
	put(attributes, 'v10r.tools.offered', call.request.toolsOffered.length);
	put(attributes, 'v10r.first_token_ms', call.response?.firstTokenMs);
	if (call.outcome === 'error') attributes['error.type'] = 'model_call_error';
	if (call.outcome === 'cancelled') attributes['error.type'] = 'cancelled';
	return {
		id: `call:${call.id}`,
		parentId,
		name: call.modelId ? `chat ${call.modelId}` : 'chat',
		operation: 'chat',
		kind: 'client',
		startOffsetMs: call.startOffsetMs ?? null,
		durationMs: call.durationMs,
		status: call.outcome === 'ok' ? 'ok' : 'error',
		attributes,
	};
}

function toolSpan(execution: ToolExecutionRecord, parentId: string): GenAiSpan {
	const descriptor = TOOL_MANIFEST.find((d) => d.name === execution.toolName);
	const attributes: Record<string, GenAiAttributeValue> = {
		'gen_ai.operation.name': 'execute_tool',
		'gen_ai.tool.name': execution.toolName,
		'gen_ai.tool.call.id': execution.toolCallId,
		'gen_ai.tool.type': 'function',
	};
	put(attributes, 'v10r.tool.risk', descriptor?.risk);
	put(attributes, 'v10r.tool.executor', descriptor?.executor);
	put(attributes, 'v10r.tool.status', execution.status);
	put(attributes, 'v10r.model_call.id', execution.modelCallId);
	if (execution.compaction) attributes['v10r.tool.result_compacted'] = true;
	// Cross-protocol correlation: the external operation this call proposed, and the remote
	// task the peer opened for it — ids only, never what was sent.
	put(attributes, 'v10r.external.protocol', execution.remoteTask?.protocol);
	put(attributes, 'v10r.external.peer', execution.remoteTask?.peerId);
	put(attributes, 'v10r.external.operation_id', execution.remoteTask?.operationId ?? undefined);
	put(attributes, 'v10r.a2a.task_id', execution.remoteTask?.taskId ?? undefined);
	put(attributes, 'v10r.a2a.context_id', execution.remoteTask?.contextId ?? undefined);
	// The error message is model-facing text a tool wrote; only its kind is telemetry.
	if (execution.status === 'error') attributes['error.type'] = 'tool_error';
	return {
		id: `tool:${execution.id}`,
		parentId,
		name: `execute_tool ${execution.toolName}`,
		operation: 'execute_tool',
		kind: 'internal',
		startOffsetMs: execution.startOffsetMs ?? null,
		durationMs: execution.durationMs ?? null,
		status: execution.status === 'error' ? 'error' : 'ok',
		attributes,
	};
}

/**
 * One turn as GenAI spans: the `invoke_agent` root first, then its provider requests in
 * attempt × step order, then its tool executions in execution order. Tool spans are children
 * of the turn, not of the provider request that asked for them — the request had ended
 * before the tool ran; `v10r.model_call.id` keeps the link.
 */
export function projectTurnTraceToGenAiSpans(trace: TurnTrace): GenAiSpan[] {
	const rootId = 'turn';
	const inputTokens = trace.modelCalls.reduce((sum, call) => sum + call.inputTokens, 0);
	const outputTokens = trace.modelCalls.reduce((sum, call) => sum + call.outputTokens, 0);
	const attributes: Record<string, GenAiAttributeValue> = {
		'gen_ai.operation.name': 'invoke_agent',
		'gen_ai.agent.name': AGENT_NAMES[trace.surface],
		'gen_ai.agent.id': trace.surface,
		'gen_ai.usage.input_tokens': inputTokens,
		'gen_ai.usage.output_tokens': outputTokens,
		'v10r.turn.outcome': trace.outcome,
		'v10r.profile.version': trace.profileVersion,
		'v10r.attempts': trace.attempts.length,
		'v10r.citations': trace.citations.length,
	};
	put(attributes, 'gen_ai.conversation.id', trace.conversationId ?? undefined);
	put(attributes, 'v10r.request.id', trace.requestId);
	put(attributes, 'v10r.proposal.id', trace.proposalId ?? undefined);
	if (trace.errorKind) attributes['error.type'] = trace.errorKind;

	const root: GenAiSpan = {
		id: rootId,
		parentId: null,
		name: `invoke_agent ${AGENT_NAMES[trace.surface]}`,
		operation: 'invoke_agent',
		kind: 'internal',
		startOffsetMs: 0,
		durationMs: null,
		status: trace.outcome === 'error' ? 'error' : trace.outcome === 'ok' ? 'ok' : 'unset',
		attributes,
	};
	return [
		root,
		...trace.modelCalls.map((call) => chatSpan(call, rootId)),
		...[...trace.toolExecutions].sort((a, b) => a.ordinal - b.ordinal).map((ex) => toolSpan(ex, rootId)),
	];
}
