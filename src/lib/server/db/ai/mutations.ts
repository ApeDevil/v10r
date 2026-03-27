import { and, eq } from 'drizzle-orm';
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

/** Delete a conversation (cascades to messages) */
export async function deleteConversation(id: string, userId: string) {
	const [deleted] = await db
		.delete(conversation)
		.where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
		.returning({ id: conversation.id });
	return !!deleted;
}

/** Save messages in bulk (idempotent via onConflictDoNothing). Auth-scoped. */
export async function saveMessages(
	conversationId: string,
	userId: string,
	messages: { id: string; role: string; content: string }[],
) {
	if (messages.length === 0) return;

	// Verify conversation ownership before inserting
	const [conv] = await db
		.select({ id: conversation.id })
		.from(conversation)
		.where(and(eq(conversation.id, conversationId), eq(conversation.userId, userId)))
		.limit(1);

	if (!conv) return;

	await db
		.insert(message)
		.values(
			messages.map((m) => ({
				id: m.id,
				conversationId,
				role: m.role as 'user' | 'assistant' | 'system',
				content: m.content,
			})),
		)
		.onConflictDoNothing();

	// Touch updatedAt so listing reflects recent activity
	await db.update(conversation).set({ updatedAt: new Date() }).where(eq(conversation.id, conversationId));
}

/** Update conversation title and touch updatedAt. Auth-scoped. */
export async function updateConversationTitle(id: string, userId: string, title: string) {
	await db
		.update(conversation)
		.set({ title, updatedAt: new Date() })
		.where(and(eq(conversation.id, id), eq(conversation.userId, userId)));
}
