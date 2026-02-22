import * as v from 'valibot';

const MessageRole = v.picklist(['user', 'assistant']);

const ChatMessageSchema = v.object({
	role: MessageRole,
	content: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
});

export const ChatRequestSchema = v.object({
	messages: v.pipe(
		v.array(ChatMessageSchema),
		v.minLength(1),
		v.maxLength(100),
	),
	conversationId: v.optional(
		v.pipe(v.string(), v.uuid()),
	),
	useRetrieval: v.optional(v.boolean()),
	retrievalTiers: v.optional(v.array(v.picklist([1, 2, 3]))),
});

export const StreamingRequestSchema = v.object({
	prompt: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
});

export const CreateConversationSchema = v.object({
	title: v.optional(
		v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	),
});
