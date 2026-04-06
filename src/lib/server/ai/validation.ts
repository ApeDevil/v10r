import * as v from 'valibot';

// AI SDK sends complex message formats after tool calls:
// - role can be 'user' | 'assistant' | 'system' | 'tool'
// - content can be string or array of parts (text, tool-call, tool-result)
const ChatMessageSchema = v.looseObject({
	role: v.picklist(['user', 'assistant', 'system', 'tool']),
	content: v.union([
		v.pipe(v.string(), v.maxLength(32_000)),
		v.array(v.looseObject({})),
	]),
});

const PanelContextEntry = v.object({
	panelType: v.pipe(v.string(), v.maxLength(64)),
	label: v.pipe(v.string(), v.maxLength(200)),
	content: v.pipe(v.string(), v.maxLength(16_000)),
});

export const ChatRequestSchema = v.object({
	messages: v.pipe(v.array(ChatMessageSchema), v.minLength(1), v.maxLength(100)),
	conversationId: v.optional(v.pipe(v.string(), v.uuid())),
	useRetrieval: v.optional(v.boolean()),
	retrievalTiers: v.optional(v.array(v.picklist([1, 2, 3]))),
	panelContext: v.optional(v.pipe(v.array(PanelContextEntry), v.maxLength(5))),
	availableTools: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(64))), v.maxLength(20))),
});

export const StreamingRequestSchema = v.object({
	prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
});

export const CreateConversationSchema = v.object({
	title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
});
