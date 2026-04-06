/**
 * AI CONVERSATION — Chat history + tool call tracking + step-level usage.
 *
 * Tables:
 *   ai.conversation       — top-level chat, scoped to user
 *   ai.message            — individual messages (user / assistant / system / tool)
 *   ai.tool_call          — tool invocations with polymorphic entity refs
 *   ai.conversation_step  — one row per AI SDK step (usage, retrieval events)
 */
import { index, integer, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const aiSchema = pgSchema('ai');

// ── Enums ───────────────────────────────────────────────────────────

export const messageRoleEnum = aiSchema.enum('message_role', ['user', 'assistant', 'system', 'tool']);

export const toolCallStatusEnum = aiSchema.enum('tool_call_status', ['pending', 'success', 'error']);

export const stepTypeEnum = aiSchema.enum('step_type', ['initial', 'tool-result', 'continue']);

// ── JSONB Types ─────────────────────────────────────────────────────

/** Structured context entry attached to a message. */
export type MessageContext = {
	entityKind: string;
	entityId: string;
	label: string;
	tokenEstimate: number;
};

/** Retrieval pipeline event recorded per step. */
export type RetrievalEvent = {
	tier: 1 | 2 | 3;
	status: 'success' | 'error' | 'skipped';
	chunkCount: number;
	durationMs: number;
};

// ── Conversation ────────────────────────────────────────────────────

export const conversation = aiSchema.table(
	'conversation',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default('New conversation'),
		/** Cached total input tokens across all steps. Recalculated on each turn. */
		totalInputTokens: integer('total_input_tokens').notNull().default(0),
		/** Cached total output tokens across all steps. Recalculated on each turn. */
		totalOutputTokens: integer('total_output_tokens').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('conversation_user_updated_idx').on(table.userId, table.updatedAt)],
);

// ── Message ─────────────────────────────────────────────────────────

export const message = aiSchema.table(
	'message',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		role: messageRoleEnum('role').notNull(),
		content: text('content').notNull(),
		/**
		 * Structured context snapshot when message was sent.
		 * Array of { entityKind, entityId, label, tokenEstimate }.
		 * Null for non-desk messages.
		 */
		context: jsonb('context').$type<MessageContext[] | null>(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('message_conv_created_idx').on(table.conversationId, table.createdAt)],
);

// ── Tool Call ────────────────────────────────────────────────────────

export const toolCall = aiSchema.table(
	'tool_call',
	{
		id: text('id').primaryKey(),
		messageId: text('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		/** AI SDK tool name (e.g. 'desk_list_files', 'desk_update_cells'). */
		toolName: text('tool_name').notNull(),
		/** Arguments passed to the tool, as provided by the model. */
		args: jsonb('args').notNull().$type<Record<string, unknown>>(),
		/** Summarized result (kept under 500 tokens). Null while pending. */
		result: jsonb('result').$type<Record<string, unknown>>(),
		status: toolCallStatusEnum('status').notNull().default('pending'),
		/** Error message when status = 'error'. */
		errorMessage: text('error_message'),
		/**
		 * Polymorphic entity reference — what desk entity was targeted.
		 * Values: 'file', 'spreadsheet', 'folder', 'markdown'.
		 * NULL for tools that don't target a specific entity.
		 */
		entityKind: text('entity_kind'),
		/** ID of the targeted entity. NULL when entityKind is NULL. */
		entityId: text('entity_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('tool_call_message_idx').on(table.messageId),
		index('tool_call_entity_idx').on(table.entityKind, table.entityId),
	],
);

// ── Conversation Step ───────────────────────────────────────────────

/**
 * One row per AI SDK step within a conversation turn.
 * Captures what onStepFinish provides: step type, token usage,
 * tool calls made, and retrieval pipeline events.
 *
 * The live I/O Log in the UI is ephemeral client state.
 * This table enables historical replay and token usage dashboards.
 */
export const conversationStep = aiSchema.table(
	'conversation_step',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		/** The user message that triggered this turn. */
		messageId: text('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		/** Step index within the turn (0-based). */
		stepIndex: integer('step_index').notNull(),
		/** AI SDK step type. */
		stepType: stepTypeEnum('step_type').notNull(),
		/** Input tokens consumed in this step. */
		inputTokens: integer('input_tokens').notNull().default(0),
		/** Output tokens produced in this step. */
		outputTokens: integer('output_tokens').notNull().default(0),
		/** Retrieval pipeline events. Null when no retrieval was performed. */
		retrievalEvents: jsonb('retrieval_events').$type<RetrievalEvent[] | null>(),
		/** Tool call IDs invoked during this step (denormalized for fast lookup). */
		toolCallIds: jsonb('tool_call_ids').$type<string[] | null>(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('conv_step_conv_msg_idx').on(table.conversationId, table.messageId),
	],
);
