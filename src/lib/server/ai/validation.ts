import * as v from 'valibot';

const MessageRole = v.picklist(['user', 'assistant']);

/** UIMessage part — text, file, or tool-related parts from AI SDK v6. */
const UIMessagePart = v.union([
	v.object({ type: v.literal('text'), text: v.pipe(v.string(), v.maxLength(32_000)) }),
	v.object({ type: v.literal('file'), url: v.string(), mediaType: v.string() }),
	v.object({ type: v.literal('tool-invocation'), toolInvocation: v.record(v.string(), v.unknown()) }),
	v.object({ type: v.literal('source-url'), url: v.string(), title: v.optional(v.string()) }),
	v.object({ type: v.literal('reasoning'), text: v.string() }),
	v.object({ type: v.literal('step-start') }),
]);

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
});

export const StreamingRequestSchema = v.object({
	prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
});

export const CreateConversationSchema = v.object({
	title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
});
