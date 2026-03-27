import { and, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { conversation, message } from '../schema/ai/conversation';

/** List conversations for a user, most recent first */
export async function listConversations(userId: string) {
	return db
		.select({
			id: conversation.id,
			title: conversation.title,
			createdAt: conversation.createdAt,
			updatedAt: conversation.updatedAt,
		})
		.from(conversation)
		.where(eq(conversation.userId, userId))
		.orderBy(desc(conversation.updatedAt))
		.limit(50);
}

/** Get a conversation with its messages, auth-scoped */
export async function getConversation(id: string, userId: string) {
	const [conv] = await db
		.select()
		.from(conversation)
		.where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
		.limit(1);

	if (!conv) return null;

	const msgs = await db
		.select()
		.from(message)
		.where(eq(message.conversationId, id))
		.orderBy(message.createdAt)
		.limit(500);

	return { ...conv, messages: msgs };
}
