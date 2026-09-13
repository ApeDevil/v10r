/**
 * Model-call middleware — records each provider request as it leaves.
 *
 * `wrapLanguageModel` is the one door that sees the request the way the provider does:
 * the prompt after every SDK transformation (`prepareStep`, `activeTools`, the last-step
 * tool withholding) and the tool definitions WITH the JSON schemas the model reads. The
 * step hooks (`onStepFinish`) see usage and the response; this sees the question. Each
 * records what only it sees; the recorder joins them by order (one open call at a time).
 *
 * Nothing here alters the call — `doStream()` runs untouched and the stream is returned
 * as-is. The response side (usage, finish reason, response id, warnings) is `onStepFinish`'s,
 * which sees the SDK-normalized shape; a call that never reaches it (a rotated attempt) is
 * closed by the recorder's `attemptEnd`.
 */
import { type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from 'ai';
import { hashSystemPrompt } from '$lib/server/ai/context/history';
import type { ModelCallRequest, PromptBlockId, ToolDefinitionRecord } from '$lib/types/turn-trace';
import type { TurnRecorder } from './recorder';

/** The provider-level call, as the middleware sees it — derived from the SDK's own middleware type. */
type WrapStreamOptions = Parameters<NonNullable<LanguageModelMiddleware['wrapStream']>>[0];
export type ModelCallOptions = WrapStreamOptions['params'];
type WrappableModel = WrapStreamOptions['model'];

/** What the middleware needs beside the recorder: the block ids the system prompt was built from. */
export interface ModelCallTraceOptions {
	blockIds: () => PromptBlockId[];
}

function isWrappable(model: LanguageModel): model is WrappableModel {
	return (
		typeof model === 'object' &&
		model !== null &&
		(model as { specificationVersion?: string }).specificationVersion === 'v3'
	);
}

/**
 * The request outline: the system prompt hashed, the history counted, the tool results in
 * it named (the earlier steps' round trips — the fact that ties an execution to the request
 * its output entered), the tools named.
 */
export function outlineCallOptions(params: ModelCallOptions, blockIds: PromptBlockId[]): ModelCallRequest {
	const system = params.prompt
		.filter((m): m is Extract<typeof m, { role: 'system' }> => m.role === 'system')
		.map((m) => m.content)
		.join('\n\n');
	const request: ModelCallRequest = {
		systemHash: hashSystemPrompt(system),
		blockIds,
		historyCount: params.prompt.filter((m) => m.role !== 'system').length,
		toolResultIds: params.prompt
			.filter((m): m is Extract<typeof m, { role: 'tool' }> => m.role === 'tool')
			.flatMap((m) => m.content.filter((part) => part.type === 'tool-result').map((part) => part.toolCallId)),
		toolsOffered: (params.tools ?? []).map((t) => t.name),
	};
	if (params.toolChoice) {
		request.toolChoice =
			params.toolChoice.type === 'tool' ? `tool:${params.toolChoice.toolName}` : params.toolChoice.type;
	}
	if (params.providerOptions) request.providerOptions = params.providerOptions as Record<string, unknown>;
	return request;
}

/** The tool definitions as sent — the model-facing description and schema of each. */
export function toolDefinitionsOf(params: ModelCallOptions): ToolDefinitionRecord[] {
	return (params.tools ?? []).map((t) =>
		t.type === 'function'
			? { name: t.name, description: t.description ?? '', inputSchema: t.inputSchema }
			: { name: t.name, description: `provider tool ${t.id}`, inputSchema: t.args ?? null },
	);
}

/**
 * Wrap a model so every stream call is reported to the recorder. A model the SDK cannot
 * wrap (a gateway id string, a v2 provider) is returned as-is — the step hooks then open
 * the call records themselves, without the request outline.
 */
export function traceModelCalls(
	model: LanguageModel,
	recorder: TurnRecorder,
	options: ModelCallTraceOptions,
): LanguageModel {
	if (!isWrappable(model)) return model;
	return wrapLanguageModel({
		model,
		middleware: {
			specificationVersion: 'v3',
			wrapStream: ({ doStream, params }) => {
				recorder.callStart({
					request: outlineCallOptions(params, options.blockIds()),
					toolset: toolDefinitionsOf(params),
				});
				return doStream();
			},
		},
	});
}
