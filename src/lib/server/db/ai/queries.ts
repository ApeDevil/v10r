import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { ChunkLevel, ModelCallRecord, ToolExecutionRecord, TurnSummary, TurnTrace } from '$lib/types/turn-trace';
import { db } from '../index';
import { conversation, message } from '../schema/ai/conversation';
import { modelCall, toolCall, turn } from '../schema/ai/turn';
import { chunk } from '../schema/retrieval/chunk';
import { corpusMap } from '../schema/retrieval/corpus-map';

export type ConversationSort = 'newest' | 'oldest';

/** List conversations for a user with token totals and the surface each belongs to. */
export async function listConversations(userId: string, sort: ConversationSort = 'newest', offset = 0, limit = 50) {
	const orderBy = sort === 'oldest' ? asc(conversation.createdAt) : desc(conversation.updatedAt);
	const where = eq(conversation.userId, userId);
	const [items, [countResult]] = await Promise.all([
		db
			.select({
				id: conversation.id,
				title: conversation.title,
				surface: conversation.surface,
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

/** Row total for a user's conversations. The quota it is measured against is
 * `ai` policy, not a property of the data — see `ai/conversation-quota.ts`. */
export async function getConversationStats(userId: string) {
	const [row] = await db.select({ total: count() }).from(conversation).where(eq(conversation.userId, userId));
	return { total: row?.total ?? 0 };
}

/** How many conversations a user currently has. */
export async function countConversations(userId: string): Promise<number> {
	const [row] = await db.select({ total: count() }).from(conversation).where(eq(conversation.userId, userId));
	return row?.total ?? 0;
}

/**
 * Get a conversation with its messages and one summary per recorded turn, auth-scoped.
 * The summaries carry what a reloaded thread renders without the full trace: outcome,
 * activations, citations and the cited catalog items behind the chips.
 */
export async function getConversation(id: string, userId: string) {
	const [conv] = await db
		.select()
		.from(conversation)
		.where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
		.limit(1);

	if (!conv) return null;

	const [msgs, turns] = await Promise.all([
		db.select().from(message).where(eq(message.conversationId, id)).orderBy(message.createdAt).limit(500),
		listTurnSummaries(id, userId),
	]);

	return { ...conv, messages: msgs, turns };
}

/** The recorded turns of one conversation, oldest first, as summaries. */
async function listTurnSummaries(conversationId: string, userId: string): Promise<TurnSummary[]> {
	const rows = await db
		.select({
			messageId: turn.messageId,
			surface: turn.surface,
			outcome: turn.outcome,
			activations: turn.activations,
			citations: turn.citations,
			grounding: turn.grounding,
			createdAt: turn.createdAt,
		})
		.from(turn)
		.where(and(eq(turn.conversationId, conversationId), eq(turn.userId, userId)))
		.orderBy(turn.createdAt)
		.limit(500);
	return rows.map((row) => ({
		messageId: row.messageId,
		surface: row.surface,
		outcome: row.outcome,
		activations: row.activations,
		citations: row.citations,
		cited: row.grounding.flatMap((source) => source.items.filter((item) => item.state === 'cited')),
		createdAt: row.createdAt.toISOString(),
	}));
}

/**
 * One turn's full trace, auth-scoped by the turn's own `user_id`. Null when the turn does not
 * exist or belongs to someone else — the same answer, so the route cannot tell the two apart.
 * Grounding bodies are NOT resolved here: `resolveGroundingBodies` does that per owner.
 */
export async function getTurn(messageId: string, userId: string): Promise<TurnTrace | null> {
	const [row] = await db
		.select()
		.from(turn)
		.where(and(eq(turn.messageId, messageId), eq(turn.userId, userId)))
		.limit(1);
	if (!row) return null;

	const [calls, executions] = await Promise.all([
		db
			.select()
			.from(modelCall)
			.where(eq(modelCall.messageId, messageId))
			.orderBy(modelCall.attemptIndex, modelCall.stepIndex),
		db.select().from(toolCall).where(eq(toolCall.messageId, messageId)).orderBy(toolCall.ordinal),
	]);

	const redacted = row.redactedAt !== null;
	const modelCalls: ModelCallRecord[] = calls.map((call) => ({
		id: call.id,
		attemptIndex: call.attemptIndex,
		stepIndex: call.stepIndex,
		providerId: call.providerId,
		modelId: call.modelId,
		inputTokens: call.inputTokens,
		outputTokens: call.outputTokens,
		durationMs: call.durationMs,
		startOffsetMs: call.startOffsetMs ?? undefined,
		request: call.request ?? { systemHash: '', blockIds: [], historyCount: 0, toolsOffered: [] },
		response: call.response,
		outcome: call.outcome,
	}));
	const toolExecutions: ToolExecutionRecord[] = executions.map((exec) => ({
		id: exec.id,
		toolCallId: exec.toolCallId,
		toolName: exec.toolName,
		ordinal: exec.ordinal,
		modelCallId: exec.modelCallId ?? undefined,
		input: exec.args,
		output: exec.result ?? undefined,
		status: exec.status,
		errorMessage: exec.errorMessage ?? undefined,
		durationMs: exec.durationMs ?? undefined,
		startOffsetMs: exec.startOffsetMs ?? undefined,
		compaction: exec.compaction ?? null,
	}));

	return {
		messageId: row.messageId,
		conversationId: row.conversationId,
		surface: row.surface,
		requestId: row.requestId,
		profileVersion: row.profileVersion,
		outcome: row.outcome,
		errorKind: (row.errorKind as TurnTrace['errorKind']) ?? null,
		timings: row.timings,
		awareness: row.awareness,
		activations: row.activations,
		blocks: row.blocks ?? [],
		grounding: row.grounding,
		history: row.history ?? { messages: [], droppedMessages: 0 },
		toolset: row.toolset ?? [],
		modelCalls,
		toolExecutions,
		attempts: row.attempts,
		citations: row.citations,
		proposalId: row.proposalId,
		createdAt: row.createdAt.toISOString(),
		bodies: redacted ? 'redacted' : 'inline',
	};
}

/**
 * Fill in the grounding bodies of a trace by id, for the owners the viewer may read
 * (their own corpus plus the system docs corpus — the caller names them). A chunk or map
 * that no longer exists keeps no body; a chunk whose live hash differs from the recorded
 * one is marked `drifted`. A recorded `parentId` is resolved to the parent as it stands
 * now (`parent`: level, position, size — current metadata, labelled so by the reader;
 * absent when the parent is gone), never rewriting the turn's own account. Catalog rows
 * are their own body and are left as recorded.
 */
export async function resolveGroundingBodies(trace: TurnTrace, ownerIds: string[]): Promise<TurnTrace> {
	const chunkIds = new Set<string>();
	const parentIds = new Set<string>();
	const mapIds = new Set<string>();
	for (const source of trace.grounding) {
		for (const item of source.items) {
			if (item.kind === 'chunk') {
				chunkIds.add(item.id);
				if (item.parentId) parentIds.add(item.parentId);
			} else if (item.kind === 'map') mapIds.add(item.id);
		}
	}
	if (chunkIds.size === 0 && mapIds.size === 0) return trace;
	for (const id of chunkIds) parentIds.delete(id);

	const [chunkRows, parentRows, mapRows] = await Promise.all([
		chunkIds.size === 0
			? []
			: db
					.select({
						id: chunk.id,
						content: chunk.content,
						contextPrefix: chunk.contextPrefix,
						contentHash: chunk.contentHash,
						level: chunk.level,
						position: chunk.position,
					})
					.from(chunk)
					.where(and(inArray(chunk.id, [...chunkIds]), inArray(chunk.userId, ownerIds))),
		parentIds.size === 0
			? []
			: db
					.select({ id: chunk.id, content: chunk.content, level: chunk.level, position: chunk.position })
					.from(chunk)
					.where(and(inArray(chunk.id, [...parentIds]), inArray(chunk.userId, ownerIds))),
		mapIds.size === 0
			? []
			: db
					.select({ id: corpusMap.id, body: corpusMap.body })
					.from(corpusMap)
					.where(and(inArray(corpusMap.id, [...mapIds]), inArray(corpusMap.userId, ownerIds))),
	]);
	const chunks = new Map(chunkRows.map((r) => [r.id, r]));
	// A parent that is itself a candidate this turn is read once, from the candidate rows.
	const parents = new Map<string, { level: ChunkLevel; position: number; chars: number }>();
	for (const r of [...chunkRows, ...parentRows]) {
		// The column's enum still lists the retired `sentence` value (see `chunkLevelEnum` for why the
		// type cannot be recreated); no row carries it and no writer produces it.
		parents.set(r.id, { level: r.level as ChunkLevel, position: r.position, chars: r.content.length });
	}
	const maps = new Map(mapRows.map((r) => [r.id, r]));

	return {
		...trace,
		grounding: trace.grounding.map((source) => ({
			...source,
			items: source.items.map((item) => {
				if (item.kind === 'chunk') {
					const row = chunks.get(item.id);
					const parent = item.parentId ? parents.get(item.parentId) : undefined;
					const withParent = parent ? { ...item, parent } : item;
					if (!row) return withParent;
					const body = row.contextPrefix ? `${row.contextPrefix}\n${row.content}` : row.content;
					return {
						...withParent,
						body,
						drifted: item.contentHash !== undefined && item.contentHash !== row.contentHash,
					};
				}
				if (item.kind === 'map') {
					const row = maps.get(item.id);
					return row ? { ...item, body: row.body } : item;
				}
				return item;
			}),
		})),
	};
}
