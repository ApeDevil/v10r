/**
 * AI TURN TRACE — what happened while one assistant message was produced.
 *
 * Tables:
 *   ai.turn        — one row per assistant message: the prompt as assembled (block bodies),
 *                    what each grounding source considered and the prompt included, the
 *                    history outline, the provider attempts, the citations
 *   ai.model_call  — one row per provider request (attempt × step): usage, request outline,
 *                    response outline
 *   ai.tool_call   — one row per tool execution, with the model-facing result
 *
 * Insert-only: every row is written once, when the turn finishes (a jsonb column updated per
 * step would rewrite its whole TOAST value each time). `ai.agent_proposal` is a trace item
 * too — it keeps its own module because the approval door writes it while the turn runs.
 *
 * The rows hold conversation content (prompt bodies, tool I/O), so they follow the
 * `ai-turn-bodies` / `ai-turns` retention windows (redact, then delete) rather than the
 * telemetry-only window the usage columns used to have. The contract these columns serialize
 * is `$lib/types/turn-trace.ts`.
 */
import { index, integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import type {
	Activation,
	AttemptRecord,
	CitationRecord,
	GroundingSource,
	ModelCallOutcome,
	ModelCallRequest,
	ModelCallResponse,
	PromptBlock,
	ToolDefinitionRecord,
	TurnAwareness,
	TurnHistory,
	TurnOutcome,
	TurnTimings,
} from '$lib/types/turn-trace';
import { user } from '../auth/_better-auth';
import { aiSchema, aiSurfaceEnum, conversation, message } from './conversation';
import { agentProposal } from './proposal';

export const toolCallStatusEnum = aiSchema.enum('tool_call_status', ['success', 'error', 'requires_approval']);

export const turn = aiSchema.table(
	'turn',
	{
		/** The assistant message the turn produced — 1:1, so the message id is the turn's key. */
		messageId: text('message_id')
			.primaryKey()
			.references(() => message.id, { onDelete: 'cascade' }),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		/** Denormalized owner: the read route checks one column, never a join. */
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		surface: aiSurfaceEnum('surface').notNull(),
		requestId: text('request_id').notNull(),
		/** Hash of identity + guidance + tool definitions — prefix stability across turns. */
		profileVersion: text('profile_version').notNull(),
		outcome: text('outcome').$type<TurnOutcome>().notNull(),
		errorKind: text('error_kind'),
		timings: jsonb('timings').$type<TurnTimings>().notNull(),
		awareness: jsonb('awareness').$type<TurnAwareness>().notNull(),
		activations: jsonb('activations').$type<Activation[]>().notNull(),
		/** The assembled system-prompt blocks WITH bodies; nulled by the redact pass. */
		blocks: jsonb('blocks').$type<PromptBlock[]>(),
		/** Per source: candidates by reference (id + hash), bodies resolved at read. */
		grounding: jsonb('grounding').$type<GroundingSource[]>().notNull(),
		/** The windowed history as sent — parts sized, never quoted; nulled by the redact pass. */
		history: jsonb('history').$type<TurnHistory>(),
		/** The tool definitions offered, once per turn; nulled by the redact pass. */
		toolset: jsonb('toolset').$type<ToolDefinitionRecord[]>(),
		attempts: jsonb('attempts').$type<AttemptRecord[]>().notNull(),
		citations: jsonb('citations').$type<CitationRecord[]>().notNull(),
		/** The proposal the turn stopped on (deskbot), when it did. */
		proposalId: text('proposal_id').references(() => agentProposal.id, { onDelete: 'set null' }),
		/** Set by the redact pass: the bodies are gone, the outline stays. */
		redactedAt: timestamp('redacted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('turn_conversation_created_idx').on(table.conversationId, table.createdAt),
		index('turn_user_created_idx').on(table.userId, table.createdAt),
	],
);

/**
 * One provider request. A turn that rotated providers has one row per attempt × step, so a
 * failed attempt is countable; usage is summed from these rows into the conversation totals.
 */
export const modelCall = aiSchema.table(
	'model_call',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		/** The assistant message the call streamed into (the turn's key). */
		messageId: text('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		/** Which provider attempt of the turn's rotation (0-based). */
		attemptIndex: integer('attempt_index').notNull().default(0),
		/** Step within the attempt (0-based); a tool round trip starts a new step. */
		stepIndex: integer('step_index').notNull(),
		/** Denormalized surface (from the parent conversation) so per-surface usage is a
		 *  plain GROUP BY with no join. Null on rows predating the surface dimension. */
		surface: aiSurfaceEnum('surface'),
		inputTokens: integer('input_tokens').notNull().default(0),
		outputTokens: integer('output_tokens').notNull().default(0),
		/** Resolved provider id for this call ('groq' | 'openai' | 'google'). Null on pre-capture rows. */
		providerId: text('provider_id'),
		/** Resolved model id for this call (e.g. 'gpt-4o-mini'). Null on pre-capture rows. */
		modelId: text('model_id'),
		/** Wall-clock duration of this call in ms. Null when not measured. */
		durationMs: integer('duration_ms'),
		/** ms from the turn's origin to the call's start. */
		startOffsetMs: integer('start_offset_ms'),
		/** The request outline (prompt hash, block ids, tools offered); nulled by the redact pass. */
		request: jsonb('request').$type<ModelCallRequest>(),
		response: jsonb('response').$type<ModelCallResponse>(),
		outcome: text('outcome').$type<ModelCallOutcome>().notNull().default('ok'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('model_call_conv_msg_idx').on(table.conversationId, table.messageId),
		index('model_call_model_idx').on(table.modelId, table.createdAt),
		index('model_call_provider_idx').on(table.providerId, table.createdAt),
		index('model_call_surface_idx').on(table.surface, table.createdAt),
	],
);

export const toolCall = aiSchema.table(
	'tool_call',
	{
		id: text('id').primaryKey(),
		messageId: text('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		/** The model call whose tool call this executed. Null when the call was not recorded. */
		modelCallId: text('model_call_id').references(() => modelCall.id, { onDelete: 'set null' }),
		/** The AI SDK's id for the call — joins the row to the message's tool part. */
		toolCallId: text('tool_call_id').notNull(),
		/** AI SDK tool name (e.g. 'desk_list_files', 'search_project_docs'). */
		toolName: text('tool_name').notNull(),
		/** Order of execution within the turn (0-based). */
		ordinal: integer('ordinal').notNull().default(0),
		/** Arguments passed to the tool, as provided by the model. */
		args: jsonb('args').notNull().$type<Record<string, unknown>>(),
		/** The model-facing result (post-compaction), capped; nulled by the redact pass. */
		result: jsonb('result').$type<unknown>(),
		status: toolCallStatusEnum('status').notNull(),
		/** Error message when status = 'error'. */
		errorMessage: text('error_message'),
		durationMs: integer('duration_ms'),
		startOffsetMs: integer('start_offset_ms'),
		/** Set when the result was compacted: the ref the model resolves and the original size. */
		compaction: jsonb('compaction').$type<{ ref: string; originalBytes: number }>(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('tool_call_message_idx').on(table.messageId),
		index('tool_call_model_call_idx').on(table.modelCallId),
	],
);
