/**
 * AI CONVERSATION — Chat history persistence.
 * Stores conversations and messages scoped to authenticated users.
 */
import { index, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const aiSchema = pgSchema('ai');

export const messageRoleEnum = aiSchema.enum('message_role', ['user', 'assistant', 'system']);

export const conversation = aiSchema.table(
	'conversation',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default('New conversation'),
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
		/** Snapshot of active panel context when message was sent. Null for non-desk messages. */
		context: jsonb('context'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('message_conv_created_idx').on(table.conversationId, table.createdAt)],
);
