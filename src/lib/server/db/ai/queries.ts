import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { MAX_CONVERSATIONS_PER_USER } from '$lib/server/config';
import { db } from '../index';
import { conversation, message } from '../schema/ai/conversation';

export type ConversationSort = 'newest' | 'oldest';

/** List conversations for a user with token totals. */
export async function listConversations(userId: string, sort: ConversationSort = 'newest', offset = 0, limit = 50) {
	const orderBy = sort === 'oldest' ? asc(conversation.createdAt) : desc(conversation.updatedAt);
	const where = eq(conversation.userId, userId);
	const [items, [countResult]] = await Promise.all([
		db
			.select({
				id: conversation.id,
				title: conversation.title,
				totalTokens: sql<number>`${conversation.totalInputTokens} + ${conversation.totalOutputTokens}`,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
			})
			.from(conversation)
			.where(where)
			.orderBy(orderBy)
			.offset(offset)
			.limit(limit),
		db.select({ total: count() }).from(conversation).where(where),
	]);
	return { items, total: countResult?.total ?? 0 };
}

/** Get aggregate stats for a user's conversation storage. */
export async function getConversationStats(userId: string) {
	const [row] = await db
		.select({
			total: count(),
			totalTokens: sql<number>`COALESCE(SUM(${conversation.totalInputTokens} + ${conversation.totalOutputTokens}), 0)`,
		})
		.from(conversation)
		.where(eq(conversation.userId, userId));
	return {
		total: row?.total ?? 0,
		totalTokens: row?.totalTokens ?? 0,
		limit: MAX_CONVERSATIONS_PER_USER,
		usagePercent: Math.round(((row?.total ?? 0) / MAX_CONVERSATIONS_PER_USER) * 100),
	};
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
