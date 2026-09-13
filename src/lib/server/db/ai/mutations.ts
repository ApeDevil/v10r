import { and, eq, inArray, sql } from 'drizzle-orm';
import type { TurnTrace } from '$lib/types/turn-trace';
import { db } from '../index';
import { conversation, message, type StoredMessagePart } from '../schema/ai/conversation';
import { modelCall, toolCall, turn } from '../schema/ai/turn';

/** Create a new conversation. `surface` is stamped once here from the orchestrator's
 *  resolved surface (chatbot/deskbot); omitted for the non-persisted rag-demo. */
export async function createConversation(userId: string, title?: string, surface?: 'chatbot' | 'deskbot') {
	const [row] = await db
		.insert(conversation)
		.values({
			id: crypto.randomUUID(),
			userId,
			title: title ?? 'New conversation',
			surface: surface ?? null,
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

/** Delete multiple conversations by ID, auth-scoped. Returns count deleted. */
export async function bulkDeleteConversations(ids: string[], userId: string): Promise<number> {
	if (ids.length === 0) return 0;
	const deleted = await db
		.delete(conversation)
		.where(and(inArray(conversation.id, ids), eq(conversation.userId, userId)))
		.returning({ id: conversation.id });
	return deleted.length;
}

const VALID_ROLES = new Set(['user', 'assistant', 'system', 'tool'] as const);

/** Save messages in bulk (idempotent via onConflictDoNothing). Auth-scoped.
 *  `route` (site-awareness): the resolved public route the turn was asked from — stamped
 *  on the user message only; null/omitted everywhere else. */
export async function saveMessages(
	conversationId: string,
	userId: string,
	messages: { id: string; role: string; content: string; route?: string | null }[],
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
					route: m.route ?? null,
				})),
			)
			.onConflictDoNothing();

		// Touch updatedAt so listing reflects recent activity
		await tx.update(conversation).set({ updatedAt: new Date() }).where(eq(conversation.id, conversationId));
	});
}

/**
 * Backfill a pre-inserted assistant message with the answer as streamed: its text and, when the
 * turn produced any, its parts (tool parts included) — what a reloaded thread renders.
 */
export async function updateMessageContent(messageId: string, content: string, parts?: StoredMessagePart[] | null) {
	await db
		.update(message)
		.set(parts === undefined ? { content } : { content, parts })
		.where(eq(message.id, messageId));
}

/** Update conversation title and touch updatedAt. Auth-scoped. */
export async function updateConversationTitle(id: string, userId: string, title: string) {
	await db
		.update(conversation)
		.set({ title, updatedAt: new Date() })
		.where(and(eq(conversation.id, id), eq(conversation.userId, userId)));
}

/**
 * Persist a turn's trace in one transaction: the `ai.turn` row, one `ai.model_call` row per
 * provider request and one `ai.tool_call` row per tool execution. Insert-only — a turn is
 * written once, when it finishes (`onConflictDoNothing` makes a retried flush a no-op).
 * Auth-scoped through the conversation: a trace never lands on a thread the user does not own.
 */
export async function saveTurnTrace(trace: TurnTrace, userId: string): Promise<void> {
	if (!trace.conversationId) return;
	const conversationId = trace.conversationId;
	await db.transaction(async (tx) => {
		const [conv] = await tx
			.select({ id: conversation.id })
			.from(conversation)
			.where(and(eq(conversation.id, conversationId), eq(conversation.userId, userId)))
			.limit(1);
		if (!conv) return;

		await tx
			.insert(turn)
			.values({
				messageId: trace.messageId,
				conversationId,
				userId,
				surface: trace.surface,
				requestId: trace.requestId,
				profileVersion: trace.profileVersion,
				outcome: trace.outcome,
				errorKind: trace.errorKind,
				timings: trace.timings,
				awareness: trace.awareness,
				activations: trace.activations,
				blocks: trace.blocks,
				grounding: trace.grounding,
				history: trace.history,
				toolset: trace.toolset,
				attempts: trace.attempts,
				citations: trace.citations,
				proposalId: trace.proposalId,
			})
			.onConflictDoNothing();

		if (trace.modelCalls.length > 0) {
			await tx
				.insert(modelCall)
				.values(
					trace.modelCalls.map((call) => ({
						id: call.id,
						conversationId,
						messageId: trace.messageId,
						attemptIndex: call.attemptIndex,
						stepIndex: call.stepIndex,
						surface: trace.surface,
						inputTokens: call.inputTokens,
						outputTokens: call.outputTokens,
						providerId: call.providerId,
						modelId: call.modelId,
						durationMs: call.durationMs,
						startOffsetMs: call.startOffsetMs ?? null,
						request: call.request,
						response: call.response,
						outcome: call.outcome,
					})),
				)
				.onConflictDoNothing();
		}

		if (trace.toolExecutions.length > 0) {
			await tx
				.insert(toolCall)
				.values(
					trace.toolExecutions.map((exec) => ({
						id: exec.id,
						messageId: trace.messageId,
						modelCallId: exec.modelCallId ?? null,
						toolCallId: exec.toolCallId,
						toolName: exec.toolName,
						ordinal: exec.ordinal,
						args: (exec.input && typeof exec.input === 'object' ? exec.input : { value: exec.input }) as Record<
							string,
							unknown
						>,
						result: exec.output ?? null,
						status: exec.status,
						errorMessage: exec.errorMessage ?? null,
						durationMs: exec.durationMs ?? null,
						startOffsetMs: exec.startOffsetMs ?? null,
						compaction: exec.compaction ?? null,
					})),
				)
				.onConflictDoNothing();
		}
	});
}

/** Recalculate cached token totals on a conversation from its model calls. */
export async function refreshConversationTokens(conversationId: string) {
	await db
		.update(conversation)
		.set({
			totalInputTokens: sql`(SELECT COALESCE(SUM(${modelCall.inputTokens}), 0) FROM ${modelCall} WHERE ${modelCall.conversationId} = ${conversationId})`,
			totalOutputTokens: sql`(SELECT COALESCE(SUM(${modelCall.outputTokens}), 0) FROM ${modelCall} WHERE ${modelCall.conversationId} = ${conversationId})`,
			updatedAt: new Date(),
		})
		.where(eq(conversation.id, conversationId));
}
