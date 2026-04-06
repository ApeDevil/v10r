import * as v from 'valibot';

const MessageRole = v.picklist(['user', 'assistant']);

const ChatMessageSchema = v.object({
	role: MessageRole,
	content: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
});

const PanelContextEntry = v.object({
	panelType: v.string(),
	label: v.string(),
	content: v.pipe(v.string(), v.maxLength(16_000)),
});

const ToolScope = v.picklist(['desk:read', 'desk:write', 'desk:create', 'desk:delete']);

const DeskLayoutEntry = v.object({
	panelId: v.string(),
	fileId: v.optional(v.string()),
	fileType: v.optional(v.string()),
	label: v.string(),
});

export const ChatRequestSchema = v.object({
	messages: v.pipe(v.array(ChatMessageSchema), v.minLength(1), v.maxLength(100)),
	conversationId: v.optional(v.pipe(v.string(), v.uuid())),
	useRetrieval: v.optional(v.boolean()),
	retrievalTiers: v.optional(v.array(v.picklist([1, 2, 3]))),
	panelContext: v.optional(v.pipe(v.array(PanelContextEntry), v.maxLength(5))),
	/** Tool permission scopes — empty or omitted means no tools. */
	toolScopes: v.optional(v.array(ToolScope)),
	/** Current desk layout so AI knows what panels are open. */
	deskLayout: v.optional(v.array(DeskLayoutEntry)),
});

export const StreamingRequestSchema = v.object({
	prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
});

export const CreateConversationSchema = v.object({
	title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
});
