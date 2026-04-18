import * as v from 'valibot';

const MessageRole = v.picklist(['user', 'assistant']);

/**
 * UIMessage part — AI SDK v6 emits dynamic `tool-<toolName>` part types with
 * `state: 'output-available'|'input-available'|...`, so we accept any
 * `type` that starts with `tool-` via a loose object check and validate
 * the fixed parts strictly.
 */
const FixedUIMessagePart = v.union([
	v.object({ type: v.literal('text'), text: v.pipe(v.string(), v.maxLength(32_000)) }),
	v.object({ type: v.literal('file'), url: v.string(), mediaType: v.string() }),
	v.object({ type: v.literal('source-url'), url: v.string(), title: v.optional(v.string()) }),
	v.object({ type: v.literal('reasoning'), text: v.string() }),
	v.object({ type: v.literal('step-start') }),
]);

const DynamicToolPart = v.object({
	type: v.pipe(
		v.string(),
		v.check((s) => s.startsWith('tool-'), 'tool part type must start with "tool-"'),
	),
	toolCallId: v.optional(v.string()),
	state: v.optional(v.string()),
	input: v.optional(v.unknown()),
	output: v.optional(v.unknown()),
	errorText: v.optional(v.string()),
});

const UIMessagePart = v.union([FixedUIMessagePart, DynamicToolPart]);

/** Accept both legacy {role, content} and UIMessage {id, role, parts} formats. */
const ChatMessageSchema = v.union([
	v.object({
		role: MessageRole,
		content: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
	}),
	v.object({
		id: v.string(),
		role: MessageRole,
		parts: v.array(UIMessagePart),
		metadata: v.optional(v.unknown()),
	}),
]);

const PanelContextEntry = v.object({
	panelType: v.string(),
	label: v.string(),
	content: v.pipe(v.string(), v.maxLength(16_000)),
	status: v.optional(v.picklist(['focused', 'active', 'background'])),
	contentLevel: v.optional(v.picklist(['full', 'summary', 'title-only'])),
	tokenEstimate: v.optional(v.number()),
});

const ToolScope = v.picklist(['desk:read', 'desk:write', 'desk:create', 'desk:delete']);

const DeskLayoutEntry = v.object({
	panelId: v.string(),
	fileId: v.optional(v.string()),
	fileType: v.optional(v.string()),
	label: v.string(),
});

export const ChatRequestSchema = v.object({
	providerId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(20))),
	messages: v.pipe(v.array(ChatMessageSchema), v.minLength(1), v.maxLength(100)),
	conversationId: v.optional(v.pipe(v.string(), v.uuid())),
	useRetrieval: v.optional(v.boolean()),
	retrievalTiers: v.optional(v.array(v.picklist([1, 2, 3]))),
	fusion: v.optional(v.picklist(['none', 'rrf'])),
	/** Route this turn through the llmwiki layer (primary surface + drill-down tools). */
	useLlmwiki: v.optional(v.boolean()),
	llmwikiCollectionId: v.optional(v.nullable(v.string())),
	panelContext: v.optional(v.pipe(v.array(PanelContextEntry), v.maxLength(5))),
	/** Tool permission scopes — empty or omitted means no tools. */
	toolScopes: v.optional(v.array(ToolScope)),
	/** Current desk layout so AI knows what panels are open. */
	deskLayout: v.optional(v.array(DeskLayoutEntry)),
	/** Active workspace name for AI context. */
	activeWorkspace: v.optional(
		v.object({
			id: v.string(),
			name: v.string(),
		}),
	),
	/**
	 * When present, the chat turn is a "resume after approval" continuation
	 * of a previously approved `agent_proposal`. The orchestrator looks up
	 * the proposal's execution result and injects it as a synthetic tool
	 * result in the model's context instead of re-running the plan.
	 *
	 * Sent by the client after hitting `POST /api/ai/proposals/:id/approve`.
	 */
	resumeFromProposalId: v.optional(v.string()),
});

export const StreamingRequestSchema = v.object({
	prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
});

export const CreateConversationSchema = v.object({
	title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
});
