import { count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../index';
import { conversation, message } from '../schema/ai/conversation';
import { user } from '../schema/auth/_better-auth';
import { ADMIN_AI_PAGE_SIZE, MAX_CONVERSATIONS_PER_USER } from '$lib/server/config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIOverviewStats {
	totalConversations: number;
	totalMessages: number;
	conversationsToday: number;
	messagesToday: number;
}

export interface TopUser {
	userId: string;
	email: string;
	name: string;
	conversationCount: number;
	messageCount: number;
}

export interface UserNearLimit {
	userId: string;
	email: string;
	name: string;
	conversationCount: number;
	percentageUsed: number;
}

export interface ConversationListItem {
	id: string;
	title: string;
	userId: string;
	userEmail: string;
	messageCount: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface MessageVolumeDay {
	date: string;
	count: number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getAIOverviewStats(): Promise<AIOverviewStats> {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const [convTotal, msgTotal, convToday, msgToday] = await Promise.all([
		db.select({ total: count() }).from(conversation),
		db.select({ total: count() }).from(message),
		db.select({ total: count() }).from(conversation).where(gte(conversation.createdAt, today)),
		db.select({ total: count() }).from(message).where(gte(message.createdAt, today)),
	]);

	return {
		totalConversations: convTotal[0]?.total ?? 0,
		totalMessages: msgTotal[0]?.total ?? 0,
		conversationsToday: convToday[0]?.total ?? 0,
		messagesToday: msgToday[0]?.total ?? 0,
	};
}

export async function getTopUsersByConversations(limit = 10): Promise<TopUser[]> {
	const rows = await db
		.select({
			userId: conversation.userId,
			email: user.email,
			name: user.name,
			conversationCount: count(),
			messageCount: sql<number>`(
				SELECT count(*) FROM ai.message m
				JOIN ai.conversation c2 ON c2.id = m.conversation_id
				WHERE c2.user_id = ${conversation.userId}
			)`,
		})
		.from(conversation)
		.innerJoin(user, eq(conversation.userId, user.id))
		.groupBy(conversation.userId, user.email, user.name)
		.orderBy(desc(sql`count(*)`))
		.limit(limit);

	return rows.map((r) => ({
		...r,
		conversationCount: Number(r.conversationCount),
		messageCount: Number(r.messageCount),
	}));
}

export async function getUsersNearLimit(threshold = 40): Promise<UserNearLimit[]> {
	const rows = await db
		.select({
			userId: conversation.userId,
			email: user.email,
			name: user.name,
			conversationCount: count(),
		})
		.from(conversation)
		.innerJoin(user, eq(conversation.userId, user.id))
		.groupBy(conversation.userId, user.email, user.name)
		.having(gte(count(), threshold))
		.orderBy(desc(count()));

	return rows.map((r) => ({
		...r,
		conversationCount: Number(r.conversationCount),
		percentageUsed: Math.round((Number(r.conversationCount) / MAX_CONVERSATIONS_PER_USER) * 100),
	}));
}

export async function getConversationsList(filters: {
	userId?: string;
	page: number;
}): Promise<{ entries: ConversationListItem[]; total: number; totalPages: number }> {
	const { userId, page } = filters;
	const offset = (page - 1) * ADMIN_AI_PAGE_SIZE;

	const baseWhere = userId ? eq(conversation.userId, userId) : undefined;

	const [entries, totalResult] = await Promise.all([
		db
			.select({
				id: conversation.id,
				title: conversation.title,
				userId: conversation.userId,
				userEmail: user.email,
				messageCount: sql<number>`(
					SELECT count(*) FROM ai.message m WHERE m.conversation_id = ${conversation.id}
				)`,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
			})
			.from(conversation)
			.innerJoin(user, eq(conversation.userId, user.id))
			.where(baseWhere)
			.orderBy(desc(conversation.updatedAt))
			.limit(ADMIN_AI_PAGE_SIZE)
			.offset(offset),
		db.select({ total: count() }).from(conversation).where(baseWhere),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		entries: entries.map((e) => ({ ...e, messageCount: Number(e.messageCount) })),
		total,
		totalPages: Math.max(1, Math.ceil(total / ADMIN_AI_PAGE_SIZE)),
	};
}

export async function getMessageVolumeByDay(days = 30): Promise<MessageVolumeDay[]> {
	const since = new Date();
	since.setDate(since.getDate() - days);
	since.setHours(0, 0, 0, 0);

	const rows = await db
		.select({
			date: sql<string>`date_trunc('day', ${message.createdAt})::date::text`,
			count: count(),
		})
		.from(message)
		.where(gte(message.createdAt, since))
		.groupBy(sql`date_trunc('day', ${message.createdAt})`)
		.orderBy(sql`date_trunc('day', ${message.createdAt})`);

	return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}
