/**
 * Historical I/O log queries — derives timeline from tool_call + conversation_step tables.
 * The live I/O log is ephemeral client state; this enables replay for past conversations.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../index';
import { conversation, conversationStep, message, toolCall } from '../schema/ai/conversation';

export interface IOLogTimelineEntry {
	type: 'tool_call' | 'step';
	timestamp: string;
	// tool_call fields
	toolName?: string;
	args?: Record<string, unknown>;
	result?: Record<string, unknown>;
	status?: string;
	entityKind?: string | null;
	entityId?: string | null;
	// step fields
	stepIndex?: number;
	stepType?: string;
	inputTokens?: number;
	outputTokens?: number;
	toolCallIds?: string[] | null;
}

/** Get the full I/O timeline for a conversation (tool calls + steps interleaved by time). */
export async function getConversationIOLog(
	conversationId: string,
	userId: string,
	limit = 100,
	offset = 0,
): Promise<{ entries: IOLogTimelineEntry[]; total: number }> {
	// Verify ownership
	const [conv] = await db
		.select({ id: conversation.id })
		.from(conversation)
		.where(and(eq(conversation.id, conversationId), eq(conversation.userId, userId)))
		.limit(1);

	if (!conv) return { entries: [], total: 0 };

	// Cap SQL fetch to what pagination actually needs
	const fetchLimit = offset + limit;

	// Fetch tool calls
	const toolCalls = await db
		.select({
			id: toolCall.id,
			toolName: toolCall.toolName,
			args: toolCall.args,
			result: toolCall.result,
			status: toolCall.status,
			entityKind: toolCall.entityKind,
			entityId: toolCall.entityId,
			createdAt: toolCall.createdAt,
		})
		.from(toolCall)
		.innerJoin(message, eq(toolCall.messageId, message.id))
		.where(eq(message.conversationId, conversationId))
		.orderBy(asc(toolCall.createdAt))
		.limit(fetchLimit);

	// Fetch steps
	const steps = await db
		.select({
			id: conversationStep.id,
			stepIndex: conversationStep.stepIndex,
			stepType: conversationStep.stepType,
			inputTokens: conversationStep.inputTokens,
			outputTokens: conversationStep.outputTokens,
			toolCallIds: conversationStep.toolCallIds,
			createdAt: conversationStep.createdAt,
		})
		.from(conversationStep)
		.where(eq(conversationStep.conversationId, conversationId))
		.orderBy(asc(conversationStep.createdAt))
		.limit(fetchLimit);

	// Merge and sort by timestamp
	const entries: IOLogTimelineEntry[] = [
		...toolCalls.map((tc) => ({
			type: 'tool_call' as const,
			timestamp: tc.createdAt.toISOString(),
			toolName: tc.toolName,
			args: tc.args as Record<string, unknown>,
			result: tc.result as Record<string, unknown> | undefined,
			status: tc.status,
			entityKind: tc.entityKind,
			entityId: tc.entityId,
		})),
		...steps.map((s) => ({
			type: 'step' as const,
			timestamp: s.createdAt.toISOString(),
			stepIndex: s.stepIndex,
			stepType: s.stepType,
			inputTokens: s.inputTokens,
			outputTokens: s.outputTokens,
			toolCallIds: s.toolCallIds,
		})),
	].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

	const total = entries.length;
	return { entries: entries.slice(offset, offset + limit), total };
}
