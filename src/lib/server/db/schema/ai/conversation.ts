/**
 * AI CONVERSATION — the thread and its messages.
 *
 * Tables:
 *   ai.conversation  — top-level chat, scoped to user
 *   ai.message       — individual messages (user / assistant / system / tool)
 *
 * What happened while an assistant message was produced — the turn trace — lives in
 * `./turn.ts` (`ai.turn` → `ai.model_call` → `ai.tool_call`), keyed by the message.
 */
import { index, integer, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const aiSchema = pgSchema('ai');

export const messageRoleEnum = aiSchema.enum('message_role', ['user', 'assistant', 'system', 'tool']);

/** Which AI surface a conversation belongs to. See `docs/blueprint/ai/surfaces.md`. */
export const aiSurfaceEnum = aiSchema.enum('ai_surface', ['chatbot', 'deskbot']);

/**
 * An assistant message's parts as the AI SDK client holds them (text, tool and reasoning
 * parts). Stored so a reloaded thread renders the tool calls the answer was built on, not
 * just its text. Shape owned by the SDK (`UIMessagePart`); never read by the server.
 */
export type StoredMessagePart = { type: string } & Record<string, unknown>;

export const conversation = aiSchema.table(
	'conversation',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default('New conversation'),
		/**
		 * Which AI surface owns this conversation (chatbot = expert Q&A, deskbot = in-desk
		 * operator). Stamped once at creation from the orchestrator's resolved `surface`.
		 * Null on rows created before this dimension existed.
		 */
		surface: aiSurfaceEnum('surface'),
		/** Cached total input tokens across all model calls. Recalculated on each turn. */
		totalInputTokens: integer('total_input_tokens').notNull().default(0),
		/** Cached total output tokens across all model calls. Recalculated on each turn. */
		totalOutputTokens: integer('total_output_tokens').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('conversation_user_updated_idx').on(table.userId, table.updatedAt)],
);

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
		 * The assistant message's parts as streamed (text + tool parts), backfilled with
		 * `content` when the turn finishes. Null on user rows and on assistant rows whose
		 * turn ended before any part reached the client.
		 */
		parts: jsonb('parts').$type<StoredMessagePart[] | null>(),
		/**
		 * Site-awareness: the resolved, allowlisted public route this turn was asked from
		 * (e.g. `/showcases/forms`) — the chatbot's location-awareness stamp. Server-resolved
		 * catalog key ONLY, never a raw URL/params/query/id. Stamped on the USER message when
		 * the page resolved; null otherwise (assistant/system/tool rows, and unresolved routes).
		 * Display metadata only — shown as a per-bubble tag, never replayed into the prompt.
		 * See `docs/blueprint/ai/site-awareness.md`.
		 */
		route: text('route'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('message_conv_created_idx').on(table.conversationId, table.createdAt)],
);
