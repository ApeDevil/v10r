import { and, eq, sql } from 'drizzle-orm';
import { createId } from '../id';
import { db } from '../index';
import { conversation, conversationStep, message, toolCall } from '../schema/ai/conversation';

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

const VALID_ROLES = new Set(['user', 'assistant', 'system', 'tool'] as const);

/** Save messages in bulk (idempotent via onConflictDoNothing). Auth-scoped. */
export async function saveMessages(
	conversationId: string,
	userId: string,
	messages: { id: string; role: string; content: string }[],
) {
	if (messages.length === 0) return;

	// Filter to valid roles before insert
	const valid = messages.filter((m) => VALID_ROLES.has(m.role as typeof VALID_ROLES extends Set<infer T> ? T : never));
	if (valid.length === 0) return;

	await db.transaction(async (tx) => {
		// Verify conversation ownership before inserting
		const [conv] = await tx
			.select({ id: conversation.id })
			.from(conversation)
			.where(and(eq(conversation.id, conversationId), eq(conversation.userId, userId)))
			.limit(1);

		if (!conv) return;

		await tx
			.insert(message)
			.values(
				valid.map((m) => ({
					id: m.id,
					conversationId,
					role: m.role as 'user' | 'assistant' | 'system' | 'tool',
					content: m.content,
				})),
			)
			.onConflictDoNothing();

		// Touch updatedAt so listing reflects recent activity
		await tx.update(conversation).set({ updatedAt: new Date() }).where(eq(conversation.id, conversationId));
	});
}

/** Update message content (used to backfill pre-inserted assistant messages). */
export async function updateMessageContent(messageId: string, content: string) {
	await db.update(message).set({ content }).where(eq(message.id, messageId));
}

/** Update conversation title and touch updatedAt. Auth-scoped. */
export async function updateConversationTitle(id: string, userId: string, title: string) {
	await db
		.update(conversation)
		.set({ title, updatedAt: new Date() })
		.where(and(eq(conversation.id, id), eq(conversation.userId, userId)));
}

/** Persist a tool call record. */
export async function saveToolCall(data: {
	messageId: string;
	toolName: string;
	args: Record<string, unknown>;
	result?: Record<string, unknown>;
	status: 'pending' | 'success' | 'error';
	errorMessage?: string;
	entityKind?: string;
	entityId?: string;
}) {
	const id = createId.toolCall();
	const [row] = await db
		.insert(toolCall)
		.values({ id, ...data })
		.returning();
	return row;
}

/** Persist a conversation step (one per AI SDK step). */
export async function saveConversationStep(data: {
	conversationId: string;
	messageId: string;
	stepIndex: number;
	stepType: 'initial' | 'tool-result' | 'continue';
	inputTokens: number;
	outputTokens: number;
	toolCallIds?: string[];
}) {
	const id = createId.conversationStep();
	await db.insert(conversationStep).values({
		id,
		...data,
		toolCallIds: data.toolCallIds ?? null,
	});
}

/** Recalculate cached token totals on a conversation from its steps. */
export async function refreshConversationTokens(conversationId: string) {
	await db
		.update(conversation)
		.set({
			totalInputTokens: sql`(SELECT COALESCE(SUM(${conversationStep.inputTokens}), 0) FROM ${conversationStep} WHERE ${conversationStep.conversationId} = ${conversationId})`,
			totalOutputTokens: sql`(SELECT COALESCE(SUM(${conversationStep.outputTokens}), 0) FROM ${conversationStep} WHERE ${conversationStep.conversationId} = ${conversationId})`,
			updatedAt: new Date(),
		})
		.where(eq(conversation.id, conversationId));
}
