import { eq, and, desc } from 'drizzle-orm';
import { db } from '../index';
import { conversation, message } from '../schema/ai/conversation';

/** Create a new conversation */
export async function createConversation(userId: string, title?: string) {
	const [row] = await db
		.insert(conversation)
		.values({
			id: crypto.randomUUID(),
			userId,
			title: title ?? 'New conversation',
		})
		.returning();
	return row;
}

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

	const messages = await db
		.select()
		.from(message)
		.where(eq(message.conversationId, id))
		.orderBy(message.createdAt);

	return { ...conv, messages };
}

/** Delete a conversation (cascades to messages) */
export async function deleteConversation(id: string, userId: string) {
	const [deleted] = await db
		.delete(conversation)
		.where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
		.returning({ id: conversation.id });
	return !!deleted;
}

/** Save messages in bulk (idempotent via onConflictDoNothing) */
export async function saveMessages(
	conversationId: string,
	messages: { id: string; role: string; content: string }[],
) {
	if (messages.length === 0) return;

	await db
		.insert(message)
		.values(
			messages.map((m) => ({
				id: m.id,
				conversationId,
				role: m.role,
				content: m.content,
			})),
		)
		.onConflictDoNothing();
}

/** Update conversation title and touch updatedAt */
export async function updateConversationTitle(id: string, title: string) {
	await db
		.update(conversation)
		.set({ title, updatedAt: new Date() })
		.where(eq(conversation.id, id));
}
